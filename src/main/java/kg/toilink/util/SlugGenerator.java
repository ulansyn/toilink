package kg.toilink.util;

import java.util.Map;

public class SlugGenerator {

    private static final Map<Character, String> TRANSLIT = Map.ofEntries(
            Map.entry('а', "a"), Map.entry('б', "b"), Map.entry('в', "v"),
            Map.entry('г', "g"), Map.entry('д', "d"), Map.entry('е', "e"),
            Map.entry('ё', "yo"), Map.entry('ж', "zh"), Map.entry('з', "z"),
            Map.entry('и', "i"), Map.entry('й', "y"), Map.entry('к', "k"),
            Map.entry('л', "l"), Map.entry('м', "m"), Map.entry('н', "n"),
            Map.entry('о', "o"), Map.entry('п', "p"), Map.entry('р', "r"),
            Map.entry('с', "s"), Map.entry('т', "t"), Map.entry('у', "u"),
            Map.entry('ф', "f"), Map.entry('х', "kh"), Map.entry('ц', "ts"),
            Map.entry('ч', "ch"), Map.entry('ш', "sh"), Map.entry('щ', "sch"),
            Map.entry('ъ', ""), Map.entry('ы', "y"), Map.entry('ь', ""),
            Map.entry('э', "e"), Map.entry('ю', "yu"), Map.entry('я', "ya"),
            // Kyrgyz specific
            Map.entry('ң', "ng"), Map.entry('ү', "u"), Map.entry('ө', "o")
    );

    /**
     * Generates a slug from person names.
     * Example: "Улансын" + "Эльнура" → "ulansyn-elnura"
     */
    public static String fromPersons(String person1, String person2) {
        String p1 = transliterate(person1);
        if (person2 == null || person2.isBlank()) return p1;
        String p2 = transliterate(person2);
        return p1 + "-" + p2;
    }

    /**
     * Generates a random 8-char alphanumeric slug as fallback.
     */
    public static String random() {
        String chars = "abcdefghijklmnopqrstuvwxyz0123456789";
        StringBuilder sb = new StringBuilder(8);
        for (int i = 0; i < 8; i++) {
            sb.append(chars.charAt((int) (Math.random() * chars.length())));
        }
        return sb.toString();
    }

    private static String transliterate(String input) {
        if (input == null || input.isBlank()) return "";
        StringBuilder sb = new StringBuilder();
        for (char c : input.toLowerCase().toCharArray()) {
            if (TRANSLIT.containsKey(c)) {
                sb.append(TRANSLIT.get(c));
            } else if (Character.isLetterOrDigit(c)) {
                sb.append(c);
            } else if (c == ' ' || c == '-') {
                sb.append('-');
            }
            // skip all other characters
        }
        // collapse multiple dashes
        return sb.toString().replaceAll("-+", "-").replaceAll("^-|-$", "");
    }
}
