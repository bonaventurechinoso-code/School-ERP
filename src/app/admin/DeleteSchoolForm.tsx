"use client";

import { softDeleteSchool } from "./actions";

export default function DeleteSchoolForm({ schoolId }: { schoolId: string }) {
  return (
    <form
      action={softDeleteSchool.bind(null, schoolId)}
      onSubmit={(e) => {
        if (!window.confirm("Warning: This will deactivate this school workspace and archive all associated tenant data. Proceed?")) {
          e.preventDefault();
        }
      }}
    >
      <button
        type="submit"
        className="text-xs px-3 py-1 rounded border text-red-600 border-red-200 hover:bg-red-50"
      >
        Delete
      </button>
    </form>
  );
}
