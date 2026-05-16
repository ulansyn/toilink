package kg.toilink.dto.response;

public record EventDashboardResponse(
        EventResponse event,
        EventStatsResponse stats
) {}
