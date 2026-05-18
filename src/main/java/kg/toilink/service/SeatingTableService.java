package kg.toilink.service;

import kg.toilink.dto.request.BulkSeatingRequest;
import kg.toilink.dto.request.CreateTableRequest;
import kg.toilink.dto.request.UpdateTableRequest;
import kg.toilink.dto.response.TableResponse;
import kg.toilink.entity.Event;
import kg.toilink.entity.Guest;
import kg.toilink.entity.SeatingTable;
import kg.toilink.entity.User;
import kg.toilink.exception.BadRequestException;
import kg.toilink.exception.NotFoundException;
import kg.toilink.repository.EventRepository;
import kg.toilink.repository.GuestRepository;
import kg.toilink.repository.SeatingTableRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class SeatingTableService {

    private final SeatingTableRepository tableRepository;
    private final EventRepository eventRepository;
    private final GuestRepository guestRepository;
    private final UserService userService;
    private final PricingService pricingService;

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
        pricingService.requireSeating(event.getPlanCode());
        SeatingTable table = tableRepository.save(SeatingTable.builder()
                .event(event)
                .name(req.name().trim())
                .capacity(req.capacity())
                .build());
        return TableResponse.from(table, 0);
    }

    @Transactional
    public TableResponse update(Long eventId, Long tableId, UpdateTableRequest req, String phone) {
        Event event = verifyOwnership(eventId, phone);
        pricingService.requireSeating(event.getPlanCode());
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
        Event event = verifyOwnership(eventId, phone);
        pricingService.requireSeating(event.getPlanCode());
        SeatingTable table = findTable(eventId, tableId);
        guestRepository.clearTableId(tableId);
        tableRepository.delete(table);
    }

    @Transactional
    public List<TableResponse> bulkAssign(Long eventId, BulkSeatingRequest req, String phone) {
        Event event = verifyOwnership(eventId, phone);
        pricingService.requireSeating(event.getPlanCode());
        if (req.assignments() == null) throw new BadRequestException("assignments is required");

        // 1) Create new tables, map tempId → real id
        Map<Long, Long> tempToReal = new HashMap<>();
        List<TableResponse> created = new ArrayList<>();
        if (req.newTables() != null) {
            for (BulkSeatingRequest.NewTable nt : req.newTables()) {
                if (nt.tempId() == null || nt.tempId() >= 0)
                    throw new BadRequestException("newTables.tempId must be negative");
                SeatingTable t = tableRepository.save(SeatingTable.builder()
                        .event(event)
                        .name(nt.name().trim())
                        .capacity(nt.capacity())
                        .build());
                tempToReal.put(nt.tempId(), t.getId());
                created.add(TableResponse.from(t, 0));
            }
        }

        if (req.assignments().isEmpty()) return created;

        // 2) Collect guest IDs + raw real table IDs that need validation
        Set<Long> guestIds = new HashSet<>();
        Set<Long> realTableIds = new HashSet<>();
        for (BulkSeatingRequest.Assignment a : req.assignments()) {
            if (a.guestId() == null) throw new BadRequestException("guestId is required");
            guestIds.add(a.guestId());
            // Only real IDs (≥0) need validation; negative tempIds we created in step 1
            if (a.tableId() != null && a.tableId() >= 0) realTableIds.add(a.tableId());
        }

        List<Guest> guests = guestRepository.findAllByEventIdAndIdIn(eventId, guestIds);
        if (guests.size() != guestIds.size())
            throw new BadRequestException("Some guests do not belong to this event");

        if (!realTableIds.isEmpty()) {
            List<SeatingTable> existing = tableRepository.findAllByEventIdOrderByCreatedAtAsc(eventId);
            Set<Long> validIds = existing.stream().map(SeatingTable::getId).collect(Collectors.toSet());
            for (Long tid : realTableIds) {
                if (!validIds.contains(tid))
                    throw new BadRequestException("Table " + tid + " does not belong to event " + eventId);
            }
        }

        // 3) Apply assignments
        Map<Long, Guest> byId = guests.stream().collect(Collectors.toMap(Guest::getId, g -> g));
        for (BulkSeatingRequest.Assignment a : req.assignments()) {
            Guest g = byId.get(a.guestId());
            g.setTableId(resolveTableId(a.tableId(), tempToReal));
        }
        guestRepository.saveAll(guests);
        return created;
    }

    private Long resolveTableId(Long raw, Map<Long, Long> tempToReal) {
        if (raw == null) return null;
        if (raw < 0) {
            Long real = tempToReal.get(raw);
            if (real == null) throw new BadRequestException("Unknown tempId: " + raw);
            return real;
        }
        return raw;
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
