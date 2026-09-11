"use client";

import { deleteSchool } from "./actions";

export default function DeleteSchoolForm({ schoolId }: { schoolId: string }) {
  return (
    <form
      action={deleteSchool.bind(null, schoolId)}
      onSubmit={(e) => {
        if (!window.confirm("CRITICAL WARNING: This will permanently wipe this school workspace and ALL associated tenant data. This action cannot be undone. Proceed?")) {
          e.preventDefault();
        }
      }}
      className="inline-block"
    >
      <button
        type="submit"
        className="inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-bold uppercase tracking-wide border shadow-sm bg-rose-50 hover:bg-rose-100 text-rose-700 border-rose-200 dark:bg-rose-500/10 dark:hover:bg-rose-500/20 dark:text-rose-400 dark:border-rose-500/20 transition-all duration-150 outline-none focus:ring-2 focus:ring-rose-400 cursor-pointer"
        title="Delete Tenant"
      >
        DELETE
      </button>
    </form>
  );
}
