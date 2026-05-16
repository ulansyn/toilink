package kg.toilink.util;

/**
 * Phone normalization for guest deduplication.
 * Strips all non-digits and known KG leading prefixes (0 → 996, 8 → 996, +996 → 996),
 * yielding a canonical digits-only string usable as an equality key.
 */
public final class PhoneUtils {

    private PhoneUtils() {}

    public static String normalize(String phone) {
        if (phone == null) return null;
        String digits = phone.replaceAll("\\D", "");
        if (digits.isEmpty()) return null;
        // Leading 0 (national) or 8 (legacy) → 996 country code
        if (digits.startsWith("0") && digits.length() == 10) {
            digits = "996" + digits.substring(1);
        } else if (digits.startsWith("8") && digits.length() == 11) {
            digits = "996" + digits.substring(1);
        }
        return digits;
    }

    public static boolean isBlank(String phone) {
        String n = normalize(phone);
        return n == null || n.isEmpty();
    }
}
