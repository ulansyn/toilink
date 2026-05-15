package kg.toilink.service;

import kg.toilink.dto.request.CreateTableRequest;
import kg.toilink.dto.request.UpdateTableRequest;
import kg.toilink.dto.response.TableResponse;
import kg.toilink.entity.Event;
import kg.toilink.entity.SeatingTable;
import kg.toilink.entity.User;
import kg.toilink.exception.NotFoundException;
import kg.toilink.repository.EventRepository;
import kg.toilink.repository.GuestRepository;
import kg.toilink.repository.SeatingTableRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class SeatingTableService {

    private final SeatingTableRepository tableRepository;
    private final EventRepository eventRepository;
    private final GuestRepository guestRepository;
    private final UserService userService;

    @Transactional(readOnly = true)
    public List<TableResponse> findAllByEvent(Long eventId, String phone) {
        verifyOwnership(eventId, phone);
        List<SeatingTable> tables = tableRepository.findAllByEventIdOrderByCreatedAtAsc(eventId);
        if (tables.isEmpty()) return List.of();
        List<Long> tableIds = tables.stream().map(SeatingTable::getId).toList();
        Map<Long, Long> counts = guestRepository.countByTableIds(tableIds).stream()
                .collect(Collectors.toMap(
                        GuestRepository.TableGuestCountView::getTableId,
                        GuestRepository.TableGuestCountView::getCnt));
        return tables.stream()
                .map(t -> TableResponse.from(t, counts.getOrDefault(t.getId(), 0L).intValue()))
                .toList();
    }

    @Transactional
    public TableResponse create(Long eventId, CreateTableRequest req, String phone) {
        Event event = verifyOwnership(eventId, phone);
        SeatingTable table = tableRepository.save(SeatingTable.builder()
                .event(event)
                .name(req.name().trim())
                .capacity(req.capacity())
                .build());
        return TableResponse.from(table, 0);
    }

    @Transactional
    public TableResponse update(Long eventId, Long tableId, UpdateTableRequest req, String phone) {
        verifyOwnership(eventId, phone);
        SeatingTable table = findTable(eventId, tableId);
        table.setName(req.name().trim());
        table.setCapacity(req.capacity());
        SeatingTable saved = tableRepository.save(table);
        int count = guestRepository.countByTableIds(List.of(tableId)).stream()
                .findFirst().map(v -> (int) v.getCnt()).orElse(0);
        return TableResponse.from(saved, count);
    }

    @Transactional
    public void delete(Long eventId, Long tableId, String phone) {
        verifyOwnership(eventId, phone);
        SeatingTable table = findTable(eventId, tableId);
        guestRepository.clearTableId(tableId);
        tableRepository.delete(table);
    }

    private SeatingTable findTable(Long eventId, Long tableId) {
        SeatingTable table = tableRepository.findById(tableId)
                .orElseThrow(() -> new NotFoundException("Table not found: " + tableId));
        if (!table.getEvent().getId().equals(eventId))
            throw new NotFoundException("Table not found: " + tableId);
        return table;
    }

    private Event verifyOwnership(Long eventId, String phone) {
        User user = userService.findByPhone(phone)
                .orElseThrow(() -> new NotFoundException("User not found for phone: " + phone));
        Event event = eventRepository.findByIdAndDeletedAtIsNull(eventId)
                .orElseThrow(() -> NotFoundException.event(eventId));
        if (event.getUser() == null || !event.getUser().getId().equals(user.getId()))
            throw NotFoundException.event(eventId);
        return event;
    }
}
