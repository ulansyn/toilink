package kg.toilink.util;

/**
 * Phone normalization for guest deduplication.
 * Strips all non-digits and normalizes KG national format (0XXXXXXXXX → 996XXXXXXXXX).
 * The 8-prefix is intentionally NOT normalized — it is ambiguous across countries
 * (Russia, Kazakhstan, legacy formats) and would produce incorrect country codes.
 */
public final class PhoneUtils {

    private PhoneUtils() {}

    public static String normalize(String phone) {
        if (phone == null) return null;
        String digits = phone.replaceAll("\\D", "");
        if (digits.isEmpty()) return null;
        if (digits.startsWith("0") && digits.length() == 10) {
            digits = "996" + digits.substring(1);
        }
        return digits;
    }

    public static boolean isBlank(String phone) {
        String n = normalize(phone);
        return n == null || n.isEmpty();
    }
}
