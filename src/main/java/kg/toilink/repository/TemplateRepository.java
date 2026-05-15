package kg.toilink.repository;

import kg.toilink.entity.Template;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface TemplateRepository extends JpaRepository<Template, Long> {

    List<Template> findAllByIsActiveTrueOrderBySortOrderAsc();

    Optional<Template> findByIdAndIsActiveTrue(Long id);

    Page<Template> findAllByOrderBySortOrderAsc(Pageable pageable);

    long countByIsActiveTrue();
}
