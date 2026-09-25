import type { Section } from '@/context/AppContext';

// Moved out of pages/Home.tsx so the step lists can be unit-tested
// (src/lib/__tests__/visit-continuity.test.ts checks the follow-up steps against iOS).
// Tabs shown and their display labels, ordered by clinical priority, per visit type.
// Narrower lists = less noise; renamed labels = more signal.
export const VISIT_TYPE_TABS: Record<string, Array<{ id: Section; label: string }>> = {
  new_consult: [
    { id: 'hpi',               label: 'CC / HPI'      },
    { id: 'pmh',               label: 'PMH'           },
    { id: 'surgical',          label: 'Surgery'       },
    { id: 'allergies',         label: 'Allergy'       },
    { id: 'medications',       label: 'Meds'          },
    { id: 'family_hx',         label: 'Family Hx'    },
    { id: 'toxic',             label: 'Social'        },
    { id: 'ros',               label: 'ROS'           },
    { id: 'examination',       label: 'Exam'          },
    { id: 'investigations',    label: 'Labs'          },
    { id: 'radiology',         label: 'Imaging'       },
    { id: 'assessment',        label: 'Assess'        },
    { id: 'plan',              label: 'Plan'          },
    { id: 'scales',            label: 'Scores'        },
    { id: 'brief',             label: 'Overview'      },
  ],
  // ── Follow-up — SOAP: Subjective → Objective → Assessment → Plan ────────────
  // Plus the standing history, reviewed and updated at every visit: PMH, surgical history,
  // medicines and allergies (owner's instruction, 2026-09-25; same steps as iOS
  // ConsultPathway.followUp). "Last visit" is the encounter history — what this visit continues.
  follow_up: [
    { id: 'encounter_history', label: 'Last visit'    },
    { id: 'hpi',               label: 'S — Interval'  },
    { id: 'pmh',               label: 'PMH'           },
    { id: 'surgical',          label: 'Surgery'       },
    { id: 'medications',       label: 'Meds'          },
    { id: 'allergies',         label: 'Allergy'       },
    { id: 'examination',       label: 'O — Exam'      },
    { id: 'investigations',    label: 'Labs'          },
    { id: 'radiology',         label: 'Imaging'       },
    { id: 'assessment',        label: 'A — Assess'    },
    { id: 'plan',              label: 'P — Plan'      },
    { id: 'scales',            label: 'Scores'        },
    { id: 'brief',             label: 'Overview'      },
  ],
  // ── Pre-op assessment — fitness for surgery + consent ────────────────────────
  pre_op: [
    { id: 'hpi',               label: 'Indication'    },
    { id: 'pmh',               label: 'PMH'           },
    { id: 'surgical',          label: 'Prev Surgery'  },
    { id: 'allergies',         label: 'Allergy'       },
    { id: 'medications',       label: 'Meds'          },
    { id: 'ros',               label: 'Systems'       },
    { id: 'examination',       label: 'Exam'          },
    { id: 'investigations',    label: 'Labs'          },
    { id: 'radiology',         label: 'Imaging'       },
    { id: 'scales',            label: 'Risk Scores'   },
    { id: 'assessment',        label: 'Risk / ASA'    },
    { id: 'plan',              label: 'Consent / Plan'},
  ],
  // ── Post-op review — Follow-up base + wound ───────────────────────────────────
  post_op: [
    { id: 'hpi',               label: 'S — Interval'  },
    { id: 'wounds',            label: 'Wound'         },
    { id: 'examination',       label: 'O — Exam'      },
    { id: 'investigations',    label: 'Labs'          },
    { id: 'assessment',        label: 'A — Assess'    },
    { id: 'plan',              label: 'P — Plan'      },
    { id: 'scales',            label: 'Scores'        },
    { id: 'monitoring',        label: 'Vitals'        },
  ],
  // ── Day of surgery — procedural ────────────────────────────────────────────────
  day_of_surgery: [
    { id: 'who_checklist',     label: 'WHO'           },
    { id: 'periop',            label: 'Periop'        },
    { id: 'procedures',        label: 'Op Note'       },
    { id: 'prescriptions',     label: 'Rx'            },
    { id: 'monitoring',        label: 'Vitals'        },
  ],
  // ── Endoscopy visits — WHO + procedure focus ──────────────────────────────────
  ercp: [
    { id: 'who_checklist',     label: 'WHO'           },
    { id: 'hpi',               label: 'Indication'    },
    { id: 'pmh',               label: 'PMH'           },
    { id: 'allergies',         label: 'Allergy'       },
    { id: 'medications',       label: 'Meds'          },
    { id: 'investigations',    label: 'Labs'          },
    { id: 'radiology',         label: 'Imaging'       },
    { id: 'procedures',        label: 'ERCP'          },
    { id: 'assessment',        label: 'Assess'        },
    { id: 'plan',              label: 'Plan'          },
  ],
  endoscopy_ogd: [
    { id: 'who_checklist',     label: 'WHO'           },
    { id: 'hpi',               label: 'Indication'    },
    { id: 'pmh',               label: 'PMH'           },
    { id: 'allergies',         label: 'Allergy'       },
    { id: 'medications',       label: 'Meds'          },
    { id: 'investigations',    label: 'Labs'          },
    { id: 'procedures',        label: 'OGD'           },
    { id: 'assessment',        label: 'Assess'        },
    { id: 'plan',              label: 'Plan'          },
  ],
  endoscopy_col: [
    { id: 'who_checklist',     label: 'WHO'           },
    { id: 'hpi',               label: 'Indication'    },
    { id: 'pmh',               label: 'PMH'           },
    { id: 'allergies',         label: 'Allergy'       },
    { id: 'medications',       label: 'Meds'          },
    { id: 'investigations',    label: 'Labs'          },
    { id: 'procedures',        label: 'Colonoscopy'   },
    { id: 'assessment',        label: 'Assess'        },
    { id: 'plan',              label: 'Plan'          },
  ],
  // ── Breast clinic — Initial visit base + breast-specific ────────────────────
  breast: [
    { id: 'hpi',               label: 'CC / Breast Hx'},
    { id: 'pmh',               label: 'PMH'           },
    { id: 'surgical',          label: 'Surgery'       },
    { id: 'allergies',         label: 'Allergy'       },
    { id: 'medications',       label: 'Meds'          },
    { id: 'family_hx',         label: 'Family Hx'    },
    { id: 'toxic',             label: 'Social'        },
    { id: 'ros',               label: 'ROS'           },
    { id: 'examination',       label: 'CBE'           },
    { id: 'investigations',    label: 'Imaging'       },
    { id: 'scales',            label: 'Scores'        },
    { id: 'assessment',        label: 'Assess'        },
    { id: 'plan',              label: 'Plan'          },
  ],
  // ── Telephone — SOAP lite ────────────────────────────────────────────────────
  telephone: [
    { id: 'hpi',               label: 'Presenting'    },
    { id: 'assessment',        label: 'Assess'        },
    { id: 'plan',              label: 'Plan'          },
  ],
  // ── Diabetic foot — Initial visit base + wound ───────────────────────────────
  diabetic_foot: [
    { id: 'hpi',               label: 'Foot Hx'       },
    { id: 'pmh',               label: 'PMH'           },
    { id: 'medications',       label: 'Meds'          },
    { id: 'allergies',         label: 'Allergy'       },
    { id: 'wounds',            label: 'Wound'         },
    { id: 'ros',               label: 'Systems'       },
    { id: 'examination',       label: 'Exam'          },
    { id: 'investigations',    label: 'Labs'          },
    { id: 'radiology',         label: 'Imaging'       },
    { id: 'assessment',        label: 'Assess'        },
    { id: 'plan',              label: 'Plan'          },
  ],
  // ── Urgent referral — Initial visit base + triage first ─────────────────────
  urgent: [
    { id: 'triage',            label: 'Triage'        },
    { id: 'hpi',               label: 'CC / HPI'      },
    { id: 'pmh',               label: 'PMH'           },
    { id: 'surgical',          label: 'Surgery'       },
    { id: 'allergies',         label: 'Allergy'       },
    { id: 'medications',       label: 'Meds'          },
    { id: 'ros',               label: 'ROS'           },
    { id: 'examination',       label: 'Exam'          },
    { id: 'investigations',    label: 'Labs'          },
    { id: 'radiology',         label: 'Imaging'       },
    { id: 'scales',            label: 'Scores'        },
    { id: 'assessment',        label: 'Assess'        },
    { id: 'plan',              label: 'Plan'          },
  ],
};

/** Display label of a step for a visit type (undefined when the visit type has no such step). */
export function visitTypeTabLabel(visitType: string, section: Section): string | undefined {
  return VISIT_TYPE_TABS[visitType]?.find(t => t.id === section)?.label;
}
