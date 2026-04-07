package kg.toilink.exception;

public class NotFoundException extends RuntimeException {

    public NotFoundException(String message) {
        super(message);
    }

    public static NotFoundException event(Long id) {
        return new NotFoundException("Event not found: " + id);
    }

    public static NotFoundException eventBySlug(String slug) {
        return new NotFoundException("Event not found: " + slug);
    }

    public static NotFoundException guest(Long id) {
        return new NotFoundException("Guest not found: " + id);
    }

    public static NotFoundException template(Long id) {
        return new NotFoundException("Template not found: " + id);
    }
}
