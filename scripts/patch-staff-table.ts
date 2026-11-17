import fs from "fs";
import path from "path";

const staffTablePath = path.resolve("src/app/[schoolDomain]/(admin)/staff/StaffTable.tsx");
let content = fs.readFileSync(staffTablePath, "utf-8");

// 1. Remove duplicate button and update Onboard button
const buttonsRegex = /<div className="flex flex-wrap items-center gap-2\.5 w-full sm:w-auto">[\s\S]*?<span>Onboard New Staff<\/span>[\s\S]*?<\/button>[\s\S]*?<\/div>/;

const newButtons = `<div className="flex flex-wrap items-center gap-2.5 w-full sm:w-auto">
            {/* ADD STAFF BUTTON */}
            <button
              onClick={() => setIsOnboardModalOpen(true)}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl text-xs transition shadow-sm flex items-center gap-1.5 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Onboard New Staff</span>
            </button>
          </div>`;

if (buttonsRegex.test(content)) {
  content = content.replace(buttonsRegex, newButtons);
  console.log("Updated toolbar buttons (removed duplicate button) successfully.");
} else {
  console.error("Could not find toolbar buttons regex.");
}

// 2. Remove inline form
const formRegex = /\{\/\* CREATE STAFF INLINE FORM \/ MODAL \*\/\}[\s\S]*?\{\/\* MASTER STAFF TABLE \*\/\}/;
if (formRegex.test(content)) {
  content = content.replace(formRegex, `{/* MASTER STAFF TABLE */}`);
  console.log("Removed inline form successfully.");
} else {
  console.error("Could not find inline form regex.");
}

// 3. Mount 5 Tier-Aware Modals before StaffDepartmentModal
const modalMountBlock = `
      {/* 5 TIER-AWARE ONBOARDING MODALS */}
      {tierCategory === "CRECHE" && (
        <CrecheStaffOnboardingModal
          isOpen={isOnboardModalOpen}
          onClose={() => setIsOnboardModalOpen(false)}
          onSuccess={() => {
            refreshRoster();
            setIsOnboardModalOpen(false);
          }}
          schoolId={schoolId}
          schoolDomain={schoolDomain}
          schoolName={schoolName}
          lineManagers={lineManagers}
        />
      )}
      {tierCategory === "NURSERY" && (
        <NurseryStaffOnboardingModal
          isOpen={isOnboardModalOpen}
          onClose={() => setIsOnboardModalOpen(false)}
          onSuccess={() => {
            refreshRoster();
            setIsOnboardModalOpen(false);
          }}
          schoolId={schoolId}
          schoolDomain={schoolDomain}
          schoolName={schoolName}
          lineManagers={lineManagers}
        />
      )}
      {tierCategory === "PRIMARY" && (
        <PrimaryStaffOnboardingModal
          isOpen={isOnboardModalOpen}
          onClose={() => setIsOnboardModalOpen(false)}
          onSuccess={() => {
            refreshRoster();
            setIsOnboardModalOpen(false);
          }}
          schoolId={schoolId}
          schoolDomain={schoolDomain}
          schoolName={schoolName}
          lineManagers={lineManagers}
        />
      )}
      {tierCategory === "SECONDARY" && (
        <SecondaryStaffOnboardingModal
          isOpen={isOnboardModalOpen}
          onClose={() => setIsOnboardModalOpen(false)}
          onSuccess={() => {
            refreshRoster();
            setIsOnboardModalOpen(false);
          }}
          schoolId={schoolId}
          schoolDomain={schoolDomain}
          schoolName={schoolName}
          lineManagers={lineManagers}
        />
      )}
      {tierCategory === "TERTIARY" && (
        <TertiaryStaffOnboardingModal
          isOpen={isOnboardModalOpen}
          onClose={() => setIsOnboardModalOpen(false)}
          onSuccess={() => {
            refreshRoster();
            setIsOnboardModalOpen(false);
          }}
          schoolId={schoolId}
          schoolDomain={schoolDomain}
          schoolName={schoolName}
          lineManagers={lineManagers}
        />
      )}

      {/* DEPARTMENTS MODAL */}`;

content = content.replace(`{/* DEPARTMENTS MODAL */}`, modalMountBlock);

fs.writeFileSync(staffTablePath, content, "utf-8");
console.log("StaffTable.tsx fully updated!");
