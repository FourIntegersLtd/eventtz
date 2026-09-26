"""Booking money rules without Stripe: pence, idempotency keys, checkout metadata and session fields."""

from __future__ import annotations

from app.features.bookings.domain_payments import (
    charge_id_from_payment_intent,
    charge_id_from_session,
    checkout_description,
    checkout_metadata,
    checkout_urls,
    expected_checkout_pence,
    gbp_to_pence,
    metadata_amount_gbp,
    payment_intent_id_from_session,
    refund_idempotency_key,
    transfer_group,
    transfer_idempotency_key,
    usable_charge_id,
)


def test_pence_rounds_the_baseline_way() -> None:
    assert gbp_to_pence(150.0) == 15000
    assert gbp_to_pence(172.5) == 17250
    assert gbp_to_pence(0.1 + 0.2) == 30
    assert gbp_to_pence(19.999) == 2000
    assert gbp_to_pence(0.004) == 0


def test_refund_and_transfer_keys_are_stable_per_booking_and_parameters() -> None:
    assert refund_idempotency_key("b-1", "full") == "refund-b-1-full"
    assert refund_idempotency_key("b-1", "cancel-client") == "refund-b-1-cancel-client"
    assert transfer_group("b-1") == "booking_b-1"
    assert (
        transfer_idempotency_key(
            booking_id="b-1", amount_pence=15000, destination_account_id="acct_9", source_charge_id=None
        )
        == "transfer-b-1-15000-acct_9"
    )
    assert (
        transfer_idempotency_key(
            booking_id="b-1", amount_pence=15000, destination_account_id="acct_9", source_charge_id="ch_4"
        )
        == "transfer-b-1-15000-acct_9-src-ch_4"
    )
    # Only a real charge id changes the key: a stray value must not split one payout into two.
    assert (
        transfer_idempotency_key(
            booking_id="b-1", amount_pence=15000, destination_account_id="acct_9", source_charge_id="py_4"
        )
        == "transfer-b-1-15000-acct_9"
    )


def test_checkout_metadata_formats_amounts_to_two_places_and_never_a_negative_discount() -> None:
    assert checkout_metadata(
        booking_id="b-1",
        vendor_user_id="v-1",
        client_user_id="c-1",
        client_total_gbp=172.5,
        vendor_amount_gbp=150.0,
        service_fee_gbp=22.5,
        referral_fee_discount_gbp=-3.0,
    ) == {
        "booking_id": "b-1",
        "vendor_user_id": "v-1",
        "client_user_id": "c-1",
        "client_total_gbp": "172.50",
        "vendor_amount_gbp": "150.00",
        "service_fee_gbp": "22.50",
        "referral_fee_discount_gbp": "0.00",
    }


def test_checkout_urls_carry_stripes_session_placeholder() -> None:
    assert checkout_urls("https://eventtz.example", "b-1") == (
        "https://eventtz.example/client/bookings/b-1?payment=success&session_id={CHECKOUT_SESSION_ID}",
        "https://eventtz.example/client/bookings/b-1?payment=cancelled",
    )


def test_checkout_description_falls_back_and_is_capped() -> None:
    assert checkout_description("Wedding") == "Wedding"
    assert checkout_description(None) == "Eventtz booking"
    assert checkout_description("") == "Eventtz booking"
    assert len(checkout_description("x" * 900)) == 500


def test_expected_pence_prefers_the_client_total_then_vendor_plus_fee() -> None:
    assert expected_checkout_pence({"client_total_gbp": "172.50"}) == 17250
    assert expected_checkout_pence({"vendor_amount_gbp": "150.00", "service_fee_gbp": "22.50"}) == 17250
    assert (
        expected_checkout_pence(
            {"client_total_gbp": "oops", "vendor_amount_gbp": "1", "service_fee_gbp": "2"}
        )
        == 300
    )
    assert expected_checkout_pence({"vendor_amount_gbp": "150.00"}) is None


def test_metadata_amounts_read_as_gbp_or_none() -> None:
    assert metadata_amount_gbp({"vendor_amount_gbp": "150.00"}, "vendor_amount_gbp") == 150.0
    assert metadata_amount_gbp({"vendor_amount_gbp": ""}, "vendor_amount_gbp") is None
    assert metadata_amount_gbp({"vendor_amount_gbp": "abc"}, "vendor_amount_gbp") is None


def test_session_payment_fields_accept_expanded_or_bare_ids_only() -> None:
    expanded = {"payment_intent": {"id": "pi_1", "latest_charge": {"id": "ch_1"}}}
    assert payment_intent_id_from_session(expanded) == "pi_1"
    assert charge_id_from_session(expanded) == "ch_1"
    assert payment_intent_id_from_session({"payment_intent": "pi_2"}) == "pi_2"
    assert charge_id_from_session({"payment_intent": "pi_2"}) is None
    assert payment_intent_id_from_session({"payment_intent": "{'id': 'pi_3'}"}) is None
    assert payment_intent_id_from_session({"payment_intent": "pi_" + "x" * 300}) is None
    assert payment_intent_id_from_session({}) is None
    assert charge_id_from_payment_intent({"latest_charge": "ch_7"}) == "ch_7"
    assert charge_id_from_payment_intent({"latest_charge": "py_7"}) is None
    assert usable_charge_id(" ch_8 ") == "ch_8"
    assert usable_charge_id("py_8") is None
