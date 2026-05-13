package kg.toilink.repository;

import kg.toilink.entity.Template;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface TemplateRepository extends JpaRepository<Template, Long> {

    List<Template> findAllByIsActiveTrueOrderBySortOrderAsc();

    Page<Template> findAllByOrderBySortOrderAsc(Pageable pageable);

    long countByIsActiveTrue();
}
