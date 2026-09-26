"""Payments rules without Stripe: webhook signatures, Connect return paths, prefill and refusals."""

from __future__ import annotations

import hashlib
import hmac

from app.core.ports import PaymentGatewayError
from app.features.payments.domain import (
    connect_link_urls,
    connect_prefill,
    is_orphan_account_error,
    is_permission_error,
    is_platform_setup_error,
    normalise_phone_for_stripe,
    parse_signature_header,
    parse_webhook_event,
    safe_connect_return_path,
    webhook_event_object,
    webhook_signature_is_valid,
)

SECRET = "whsec_unit_test_secret"
BODY = b'{"id":"evt_1","type":"checkout.session.completed","data":{"object":{"id":"cs_1"}}}'
SIGNED_AT = 1_700_000_000


def stripe_header(payload: bytes, *, secret: str = SECRET, timestamp: int = SIGNED_AT) -> str:
    """A `Stripe-Signature` header computed independently of the code under test."""
    digest = hmac.new(secret.encode(), f"{timestamp}.".encode() + payload, hashlib.sha256).hexdigest()
    return f"t={timestamp},v1={digest}"


def test_a_correctly_signed_body_verifies() -> None:
    assert webhook_signature_is_valid(BODY, stripe_header(BODY), SECRET, now_seconds=SIGNED_AT + 10)


def test_any_of_several_v1_signatures_may_match_while_a_secret_is_rolled() -> None:
    header = stripe_header(BODY) + ",v1=deadbeef"
    rolled = "t=1700000000,v1=deadbeef," + stripe_header(BODY).split(",")[1]
    assert webhook_signature_is_valid(BODY, header, SECRET, now_seconds=SIGNED_AT)
    assert webhook_signature_is_valid(BODY, rolled, SECRET, now_seconds=SIGNED_AT)


def test_a_tampered_body_fails() -> None:
    header = stripe_header(BODY)
    assert not webhook_signature_is_valid(
        BODY.replace(b"cs_1", b"cs_2"), header, SECRET, now_seconds=SIGNED_AT
    )


def test_the_wrong_secret_fails() -> None:
    header = stripe_header(BODY, secret="whsec_someone_else")
    assert not webhook_signature_is_valid(BODY, header, SECRET, now_seconds=SIGNED_AT)


def test_a_signature_older_than_five_minutes_is_a_replay() -> None:
    header = stripe_header(BODY)
    assert webhook_signature_is_valid(BODY, header, SECRET, now_seconds=SIGNED_AT + 300)
    assert not webhook_signature_is_valid(BODY, header, SECRET, now_seconds=SIGNED_AT + 301)
    assert not webhook_signature_is_valid(BODY, header, SECRET, now_seconds=SIGNED_AT - 301)


def test_an_empty_secret_never_verifies_even_a_matching_signature() -> None:
    header = stripe_header(BODY, secret="")
    assert not webhook_signature_is_valid(BODY, header, "", now_seconds=SIGNED_AT)


def test_the_acceptance_suites_bogus_header_fails() -> None:
    assert not webhook_signature_is_valid(BODY, "t=1,v1=not-a-real-signature", SECRET, now_seconds=1)
    assert not webhook_signature_is_valid(BODY, "garbage", SECRET, now_seconds=SIGNED_AT)


def test_the_header_parser_keeps_every_v1_and_ignores_other_schemes() -> None:
    assert parse_signature_header("t=12,v1=aa,v0=zz,v1=bb") == (12, ["aa", "bb"])
    assert parse_signature_header("t=soon,v1=aa") == (None, ["aa"])


def test_the_event_body_parses_to_its_object() -> None:
    event = parse_webhook_event(BODY)
    assert event is not None
    assert webhook_event_object(event) == {"id": "cs_1"}
    assert parse_webhook_event(b"[1, 2]") is None
    assert parse_webhook_event(b"not json") is None
    assert webhook_event_object({"data": {"object": "cs_1"}}) == {}


def test_return_paths_are_allowlisted() -> None:
    assert safe_connect_return_path("") == "/vendor/payments"
    assert safe_connect_return_path("/vendor/onboarding") == "/vendor/payments"
    assert safe_connect_return_path("/vendor/bookings/abc-123?tab=pay") == "/vendor/bookings/abc-123"
    assert safe_connect_return_path("/vendor/bookings/abc/extra") == "/vendor/payments"
    assert safe_connect_return_path("/vendor/bookings/" + "a" * 65) == "/vendor/payments"
    assert safe_connect_return_path("https://evil.example/") == "/vendor/payments"


def test_connect_links_come_back_to_the_safe_path() -> None:
    assert connect_link_urls("https://eventtz.example", "/vendor/payments") == (
        "https://eventtz.example/vendor/payments?stripe=refresh",
        "https://eventtz.example/vendor/payments?stripe=return",
    )


def test_phone_numbers_become_e164_only_when_certain() -> None:
    assert normalise_phone_for_stripe("07700 900123") == "+447700900123"
    # A leading + is trusted as international; its digits are kept exactly (the baseline's rule).
    assert normalise_phone_for_stripe("+44 (0)20 7946 0000") == "+4402079460000"
    assert normalise_phone_for_stripe("7700900123") is None
    assert normalise_phone_for_stripe("0123") is None
    assert normalise_phone_for_stripe("   ") is None
    assert normalise_phone_for_stripe(None) is None


def test_prefill_uses_only_what_the_vendor_filled_in() -> None:
    prefill = connect_prefill(
        "vendor@example.com",
        {
            "businessName": " Sunny Cakes ",
            "firstName": "Ada",
            "lastName": "",
            "phone": "07700 900123",
            "baseCity": "Leeds",
            "postalCode": "LS1 1AA",
        },
    )
    assert prefill.email == "vendor@example.com"
    assert prefill.individual == {
        "email": "vendor@example.com",
        "first_name": "Ada",
        "phone": "+447700900123",
        "address": {"city": "Leeds", "postal_code": "LS1 1AA", "country": "GB"},
    }
    assert prefill.business_profile == {"name": "Sunny Cakes"}


def test_an_empty_profile_prefills_nothing() -> None:
    prefill = connect_prefill(None, None)
    assert (prefill.email, prefill.individual, prefill.business_profile) == (None, {}, {})


def test_only_stripes_invalid_request_wording_marks_an_account_as_orphaned() -> None:
    gone = PaymentGatewayError("No such account: 'acct_1'", stripe_code="resource_missing", http_status=404)
    other_platform = PaymentGatewayError("The account is not connected to your platform", http_status=400)
    key_mismatch = PaymentGatewayError("Does not have access to account acct_1", http_status=403)
    assert is_orphan_account_error(gone)
    assert is_orphan_account_error(other_platform)
    # A 403 is a key mismatch: wiping the account id then would strand a paid vendor.
    assert not is_orphan_account_error(key_mismatch)
    assert is_permission_error(key_mismatch)
    assert not is_orphan_account_error(PaymentGatewayError())


def test_platform_setup_refusals_are_recognised() -> None:
    assert is_platform_setup_error(
        PaymentGatewayError("You must complete your platform profile to use Connect.", http_status=400)
    )
    assert is_platform_setup_error(
        PaymentGatewayError("Connect is not enabled for this platform account", http_status=403)
    )
    assert not is_platform_setup_error(PaymentGatewayError("Card declined", http_status=402))
    assert not is_platform_setup_error(PaymentGatewayError("Some other permission", http_status=403))
