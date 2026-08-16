/** QA accounts for the admin team. Shown on admin Settings. */

export type AdminTestAccount = {
  role: "Vendor" | "Client";
  email: string;
  password: string;
};

export const ADMIN_TEST_ACCOUNTS: readonly AdminTestAccount[] = [
  {
    role: "Vendor",
    email: "nisha.nigeria@gmail.com",
    password: "zuTnif-tomcid-7ronco",
  },
  {
    role: "Client",
    email: "y.hkehinde@yahoo.com",
    password: "awesome95",
  },
];
