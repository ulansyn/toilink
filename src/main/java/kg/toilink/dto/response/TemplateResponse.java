package kg.toilink.dto.response;

import kg.toilink.entity.Template;

public record TemplateResponse(
        Long id,
        String name,
        String description,
        String thumbnailUrl,
        String category,
        String templatePath,
        String blocksSchema,
        int sortOrder
) {
    public static TemplateResponse from(Template t) {
        return new TemplateResponse(
                t.getId(),
                t.getName(),
                t.getDescription(),
                t.getThumbnailUrl(),
                t.getCategory(),
                t.getTemplatePath(),
                t.getBlocksSchema(),
                t.getSortOrder()
        );
    }
}
