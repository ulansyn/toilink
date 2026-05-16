package kg.toilink.dto.response;

public record EventStatsResponse(
        long total,
        long attending,
        long declined,
        long maybe
) {}
