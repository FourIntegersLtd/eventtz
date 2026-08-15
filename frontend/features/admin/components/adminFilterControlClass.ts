import { formControlClass } from "@/components/ui/tokens";

/** Full-width admin list filter control (search, status, etc.). */
export const adminFilterControlClass = `${formControlClass()} mt-1 block`;

/** Filter control with a fixed width from `sm` breakpoint up. */
export const adminFilterControlClassSm = `${adminFilterControlClass} sm:w-48`;

/** Filter control with a fixed width from `lg` breakpoint up. */
export const adminFilterControlClassLg36 = `${adminFilterControlClass} lg:w-36`;

export const adminFilterControlClassLg44 = `${adminFilterControlClass} lg:w-44`;
