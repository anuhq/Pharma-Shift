import { useState } from "react";

const sections = [
  {
    key: "categories",
    title: "Incident Categories",
    description: "Create and maintain the categories used to classify staff incidents.",
    label: "Setup",
  },
  {
    key: "incidents",
    title: "Incident Records",
    description: "Report incidents, review records and update incident information.",
    label: "Core Function",
  },
  {
    key: "investigations",
    title: "Investigations",
    description: "Record investigation findings and monitor the investigation status.",
    label: "Manager",
  },
  {
    key: "actions",
    title: "Corrective Actions",
    description: "Assign corrective actions and track the progress of each action.",
    label: "Manager",
  },
];

function IncidentCorrectiveAction() {
  const [activeSection, setActiveSection] = useState(null);

  const selectedSection = sections.find(
    (section) => section.key === activeSection,
  );

  return (
    <div className="container-fluid py-4">
      <div className="d-flex flex-column flex-md-row justify-content-between align-items-md-start gap-3 mb-4">
        <div>
          <h2 className="mb-2">Staff Incident &amp; Corrective Action</h2>
          <p className="text-muted mb-0">
            Record incidents, investigate causes and manage corrective actions.
          </p>
        </div>

        <span className="badge text-bg-primary px-3 py-2">
          Owner / Manager
        </span>
      </div>

      <div className="row g-4">
        {sections.map((section) => (
          <div className="col-12 col-md-6" key={section.key}>
            <div className="card h-100 border-0 shadow-sm">
              <div className="card-body d-flex flex-column">
                <div className="d-flex justify-content-between align-items-start gap-3 mb-3">
                  <h5 className="card-title mb-0">{section.title}</h5>
                  <span className="badge text-bg-light border">
                    {section.label}
                  </span>
                </div>

                <p className="card-text text-muted flex-grow-1">
                  {section.description}
                </p>

                <button
                  type="button"
                  className="btn btn-outline-primary align-self-start"
                  onClick={() => setActiveSection(section.key)}
                >
                  Open Section
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {selectedSection && (
        <div className="card border-primary shadow-sm mt-4">
          <div className="card-body">
            <div className="d-flex justify-content-between align-items-start gap-3">
              <div>
                <h5 className="card-title">{selectedSection.title}</h5>
                <p className="card-text text-muted mb-0">
                  This section is ready for its form and database workflow.
                  We will implement it step by step.
                </p>
              </div>

              <button
                type="button"
                className="btn btn-sm btn-outline-secondary"
                onClick={() => setActiveSection(null)}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default IncidentCorrectiveAction;