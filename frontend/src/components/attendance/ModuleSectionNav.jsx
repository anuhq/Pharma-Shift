function ModuleSectionNav({
  sections,
  activeSection,
  onSectionChange,
}) {
  return (
    <div
      className="nav nav-pills gap-2 mb-4"
      role="group"
      aria-label="Attendance module sections"
    >
      {sections.map((section) => (
        <button
          key={section.id}
          type="button"
          className={`nav-link ${
            activeSection === section.id ? 'active' : ''
          }`}
          aria-pressed={activeSection === section.id}
          aria-controls="attendance-module-section"
          onClick={() => onSectionChange(section.id)}
        >
          {section.label}
        </button>
      ))}
    </div>
  );
}

export default ModuleSectionNav;