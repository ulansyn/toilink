package kg.toilink.controller.organizer;

import kg.toilink.exception.BadRequestException;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.MediaType;
import org.springframework.util.StringUtils;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.io.InputStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.nio.file.StandardCopyOption;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/organizer")
public class UploadController {

    @Value("${app.upload-dir:uploads}")
    private String uploadDir;

    @PostMapping(value = "/upload", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public Map<String, String> upload(@RequestParam("file") MultipartFile file,
                                      @RequestHeader("X-User-Phone") String phone) throws IOException {
        if (file.isEmpty()) throw new BadRequestException("Файл пустой");

        Path dir = Paths.get(uploadDir).toAbsolutePath();
        Files.createDirectories(dir);

        String ext = detectImageExtension(file);
        String filename = UUID.randomUUID() + "." + ext;

        try (InputStream inputStream = file.getInputStream()) {
            Files.copy(inputStream, dir.resolve(filename), StandardCopyOption.REPLACE_EXISTING);
        }

        return Map.of("url", "/uploads/" + filename);
    }

    private String detectImageExtension(MultipartFile file) throws IOException {
        String originalExt = StringUtils.getFilenameExtension(file.getOriginalFilename());
        String normalizedExt = originalExt != null ? originalExt.toLowerCase() : "";

        try (InputStream inputStream = file.getInputStream()) {
            byte[] header = inputStream.readNBytes(12);
            if (isJpeg(header)) return "jpg";
            if (isPng(header)) return "png";
            if (isWebp(header)) return "webp";
        }

        throw new BadRequestException("Допустимы только JPG, PNG или WEBP"
                + (normalizedExt.isBlank() ? "" : " (получен ." + normalizedExt + ")"));
    }

    private boolean isJpeg(byte[] header) {
        return header.length >= 3
                && (header[0] & 0xFF) == 0xFF
                && (header[1] & 0xFF) == 0xD8
                && (header[2] & 0xFF) == 0xFF;
    }

    private boolean isPng(byte[] header) {
        return header.length >= 8
                && (header[0] & 0xFF) == 0x89
                && header[1] == 0x50
                && header[2] == 0x4E
                && header[3] == 0x47
                && header[4] == 0x0D
                && header[5] == 0x0A
                && header[6] == 0x1A
                && header[7] == 0x0A;
    }

    private boolean isWebp(byte[] header) {
        return header.length >= 12
                && header[0] == 'R'
                && header[1] == 'I'
                && header[2] == 'F'
                && header[3] == 'F'
                && header[8] == 'W'
                && header[9] == 'E'
                && header[10] == 'B'
                && header[11] == 'P';
    }
}
