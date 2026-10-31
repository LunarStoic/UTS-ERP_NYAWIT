/** Peran yang boleh dimiliki seorang mitra. Cocok dengan `CHECK` pada kolom `role_code` di tabel. */
export type PartnerRoleCode = 'SUPPLIER' | 'CUSTOMER' | 'BORROWER';

const VALID_ROLE_CODES: ReadonlySet<string> = new Set<PartnerRoleCode>([
    'SUPPLIER',
    'CUSTOMER',
    'BORROWER'
]);

export function isPartnerRoleCode(value: string): value is PartnerRoleCode {
    return VALID_ROLE_CODES.has(value);
}
