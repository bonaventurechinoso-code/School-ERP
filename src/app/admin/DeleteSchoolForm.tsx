"use client";

import { deleteSchool } from "./actions";
import { Trash2 } from "lucide-react";

export default function DeleteSchoolForm({ schoolId }: { schoolId: string }) {
  return (
    <form
      action={deleteSchool.bind(null, schoolId)}
      onSubmit={(e) => {
        if (!window.confirm("CRITICAL WARNING: This will permanently wipe this school workspace and ALL associated tenant data. This action cannot be undone. Proceed?")) {
          e.preventDefault();
        }
      }}
    >
      <button
        type="submit"
        className="p-1.5 rounded-md text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 hover:text-red-700 dark:hover:text-red-300 transition-colors focus:ring-2 focus:ring-red-500 outline-none"
        title="Delete Tenant"
      >
        <Trash2 className="w-4 h-4" />
      </button>
    </form>
  );
}
