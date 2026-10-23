import type { ToastInput } from "@/lib/toastInput";
import { DATE_CHANGE_ERROR_COPY } from "@/lib/bookingDateChangeApi";
import {
  getApiErrorCode,
  getApiErrorDetail,
  BOOKING_RULE_ERROR_MESSAGES,
  TERMS_NOT_ACCEPTED_CODE,
  TERMS_NOT_ACCEPTED_MESSAGE,
} from "@/lib/api-errors";

type ShowToast = (toast: ToastInput) => void;

export type MutationFeedbackOptions<T> = {
  successTitle: string;
  successDescription?: string | ((result: T) => string | undefined);
  errorTitle?: string;
  errorDescription?: string | ((error: unknown) => string | undefined);
  run: () => Promise<T>;
  showSuccessToast?: boolean;
  showErrorToast?: boolean;
};

export function mutationErrorMessage(error: unknown, fallback = "Please try again."): string {
  if (getApiErrorCode(error) === TERMS_NOT_ACCEPTED_CODE) return TERMS_NOT_ACCEPTED_MESSAGE;
  const code = getApiErrorCode(error);
  if (code && BOOKING_RULE_ERROR_MESSAGES[code]) return BOOKING_RULE_ERROR_MESSAGES[code];
  if (code && DATE_CHANGE_ERROR_COPY[code]) return DATE_CHANGE_ERROR_COPY[code];
  return getApiErrorDetail(error) ?? fallback;
}

export async function withMutationFeedback<T>(
  showToast: ShowToast,
  options: MutationFeedbackOptions<T>,
): Promise<T | null> {
  try {
    const result = await options.run();
    if (options.showSuccessToast !== false) {
      const description =
        typeof options.successDescription === "function"
          ? options.successDescription(result)
          : options.successDescription;
      showToast({
        title: options.successTitle,
        description,
        tone: "success",
      });
    }
    return result;
  } catch (error: unknown) {
    if (options.showErrorToast !== false) {
      const description =
        typeof options.errorDescription === "function"
          ? options.errorDescription(error)
          : options.errorDescription ?? mutationErrorMessage(error);
      showToast({
        title: options.errorTitle ?? "Something went wrong",
        description,
        tone: "error",
      });
    }
    return null;
  }
}
