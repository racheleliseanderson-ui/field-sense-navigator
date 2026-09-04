FIELD SENSE NAVIGATOR - LOCAL SCRIPT FIX

The repository has already been updated with these operational files.
Preferred setup on your Windows machine:

  1. Open the field-sense-navigator repository folder.
  2. Run: git pull
  3. Use RUN-SEEDING.bat when you want NEW waterways.
  4. Use RUN-REFRESH.bat for normal ongoing maintenance.
  5. Use RUN-FULL-REFRESH.bat only when you want every catalog source reread.
  6. HEALTH-CHECK.bat remains read-only.

RUN-SEEDING now:
- rotates discovery toward least-covered jurisdictions
- remembers recently scanned jurisdictions so repeated runs move outward
- proves candidates before writing them
- searches supplemental pages on the SAME trusted agency host for missing
  access/species evidence
- reapplies agency/regulation enrichment
- resolves location, gauge/tide, and weather bindings
- runs catalog and pipeline checks before offering to commit/push

RUN-REFRESH now:
- refreshes the 220 oldest records instead of rereading 1,000+ every run
- reapplies enrichment and station/location bindings
- runs checks before offering to commit/push

RUN-FULL-REFRESH:
- is the separate all-record deep sweep

Accuracy rule:
Fields that cannot be supported by official evidence remain empty. The scripts
never fabricate season windows or human-review provenance.
