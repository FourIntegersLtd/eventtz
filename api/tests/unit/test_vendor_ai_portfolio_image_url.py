"""Portfolio photo QA by URL: only the caller's own, size-capped upload is read and sent to the model."""

from __future__ import annotations

import pytest

from app.core.auth import Principal
from app.core.ports import StorageError
from app.core.settings import get_settings
from app.features.vendors import errors, service_ai
from app.features.vendors.schemas_ai import AnalyzePortfolioImageUrlBody
from tests.support.fakes import FAKE_STORAGE_HOST, FakeLanguageModel, FakeStorage

CALLER = Principal(id="vendor-1", email="vendor-1@example.com", user_type="vendor")
VISION_REPLY = {"ok": True, "score": 9, "summary": "  Bright and sharp.  "}


def _body(key: str, host: str = FAKE_STORAGE_HOST) -> AnalyzePortfolioImageUrlBody:
    """A request naming `key` on `host`."""
    return AnalyzePortfolioImageUrlBody(image_url=f"https://{host}/{key}")


async def test_own_image_is_read_from_storage_and_analysed() -> None:
    """Happy path: the stored bytes reach the model and the score is clamped to 1-5."""
    storage = FakeStorage()
    storage.save(key="users/vendor-1/images/a.png", body=b"png-bytes", content_type="image/png; x=y")
    model = FakeLanguageModel(reply=VISION_REPLY)
    result = await service_ai.analyze_portfolio_image_from_url(
        principal=CALLER, body=_body("users/vendor-1/images/a.png"), storage=storage, language_model=model
    )
    assert (result.ok, result.score, result.summary) == (True, 5, "Bright and sharp.")
    [call] = model.calls
    assert call.image_data_url == "data:image/png;base64,cG5nLWJ5dGVz"


async def test_another_users_image_is_refused_before_any_read() -> None:
    """A key under a different user's folder is 403 and never reaches the model."""
    storage = FakeStorage()
    storage.save(key="users/vendor-2/images/a.png", body=b"secret", content_type="image/png")
    model = FakeLanguageModel(reply=VISION_REPLY)
    with pytest.raises(errors.ImageNotOwned) as refusal:
        await service_ai.analyze_portfolio_image_from_url(
            principal=CALLER, body=_body("users/vendor-2/images/a.png"), storage=storage, language_model=model
        )
    assert refusal.value.code == "vendor_onboarding_ai_image_not_owned"
    assert model.calls == []


@pytest.mark.parametrize(
    "url",
    [
        "https://files.example/other/users/vendor-1/a.png",
        "https://files.example/users/vendor-1/../vendor-2/a.png",
        "https://files.example/users/vendor-10/a.png",
    ],
)
async def test_the_users_folder_must_be_the_start_of_the_key(url: str) -> None:
    """The folder cannot be smuggled into the middle of a path, via `..`, or by a longer id."""
    with pytest.raises(errors.ImageNotOwned):
        await service_ai.analyze_portfolio_image_from_url(
            principal=CALLER,
            body=AnalyzePortfolioImageUrlBody(image_url=url),
            storage=FakeStorage(),
            language_model=FakeLanguageModel(reply=VISION_REPLY),
        )


async def test_a_url_outside_our_bucket_is_refused() -> None:
    """A foreign host is `ImageUrlInvalid`, as before."""
    with pytest.raises(errors.ImageUrlInvalid):
        await service_ai.analyze_portfolio_image_from_url(
            principal=CALLER,
            body=_body("users/vendor-1/a.png", host="evil.example"),
            storage=FakeStorage(),
            language_model=FakeLanguageModel(reply=VISION_REPLY),
        )


async def test_an_image_over_the_upload_cap_is_refused() -> None:
    """One byte over `media_max_image_upload_bytes` is 413 and never reaches the model."""
    storage = FakeStorage()
    storage.save(
        key="users/vendor-1/big.png",
        body=b"x" * (get_settings().media_max_image_upload_bytes + 1),
        content_type="image/png",
    )
    model = FakeLanguageModel(reply=VISION_REPLY)
    with pytest.raises(errors.ImageTooLarge) as refusal:
        await service_ai.analyze_portfolio_image_from_url(
            principal=CALLER, body=_body("users/vendor-1/big.png"), storage=storage, language_model=model
        )
    assert (refusal.value.status, refusal.value.code) == (413, "vendor_onboarding_ai_image_too_large")
    assert model.calls == []


async def test_a_missing_own_object_is_not_found() -> None:
    """Our own key with nothing stored is a client problem: 404, not a gateway error."""
    with pytest.raises(errors.ImageNotFound) as failure:
        await service_ai.analyze_portfolio_image_from_url(
            principal=CALLER,
            body=_body("users/vendor-1/gone.png"),
            storage=FakeStorage(),
            language_model=FakeLanguageModel(reply=VISION_REPLY),
        )
    assert (failure.value.status, failure.value.code) == (404, "vendor_onboarding_ai_image_not_found")


async def test_a_storage_outage_is_a_fetch_failure() -> None:
    """Storage failing is 502 `..._fetch_failed`; other exceptions are bugs and propagate."""
    with pytest.raises(errors.ImageFetchFailed) as failure:
        await service_ai.analyze_portfolio_image_from_url(
            principal=CALLER,
            body=_body("users/vendor-1/a.png"),
            storage=FakeStorage(error=StorageError("s3 down")),
            language_model=FakeLanguageModel(reply=VISION_REPLY),
        )
    assert failure.value.status == 502
