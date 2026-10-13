
function ModuleSectionNav({
  sections,
  activeSection,
  onSectionChange,
}) {
  return (
    <div
      className="d-flex flex-wrap gap-2 mb-4"
      role="group"
      aria-label="Attendance module sections"
    >
      {sections.map((section) => {
        const isActive = activeSection === section.id;

        return (
          <button
            key={section.id}
            type="button"
            className={`btn ${
              isActive
                ? 'btn-primary'
                : 'btn-outline-primary'
            }`}
            aria-pressed={isActive}
            aria-controls="attendance-module-section"
            onClick={() => onSectionChange(section.id)}
          >
            {section.label}
          </button>
        );
      })}
    </div>
  );
}

export default ModuleSectionNav;
