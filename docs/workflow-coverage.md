# Prototype workflow coverage

The reference is School_Admin_Desk_Prototype (1).html. Terminology, records, fields, and controls informed the implementation. The application uses an original interface and a separate synthetic dataset.

## Personnel and administration

| Prototype section | Interactions and content | Application |
| --- | --- | --- |
| Home | Reference date, attention alerts, and counts for employment status, classification, 201 status, loyalty, NOSI, retirement, and PRC renewal. Show opens the employee filter. | The dashboard links into the shared filters at /employees. Counts use the same rules as list and report results. |
| Employees | Search name or position, change filters, add an employee with name, ID, position, classification, employment status, birth, hire and step dates, monthly salary, and PRC expiry. Open a profile for age, service, retirement, 201 and property custody. | /employees, /employees/new and /employees/[id]. The profile supports updates with conflict detection and archive/restore. Opening salary details and PRC expiry can be entered during creation. Age, service, step and retirement use the same draft rules in the live add form and saved profile. |
| 201 file | Checklist of 21 document types. Set Complete, Pending, or N/A. N/A counts as reviewed. Save the review date and remarks, and print the checklist. | Profile sections use document-type records and explicit statuses. Staff can attach private PDFs or images. The printable checklist is a draft template. |
| Calendar | Twelve month-jump buttons, previous, next, Today, Sunday-first grid and current-day indicator. | /calendar preserves the month controls and Manila-date indicator. Staff can add shared, one-day events with an optional time and notes. Auditors can view saved events. |
| NOSI | Schedule and status counts, current salary grade and step, last step date, eligibility date, draft new salary, status selector, and a Print NOSI demo action. | /nosi updates cycle-specific progress and opens a printable draft. Salary history records the actual effective date and amount, with an option to begin a new step cycle. |
| Reports | 201 completeness, NOSI/step update, loyalty award, retirement, and license renewal. Toggle between records marked YES and all staff, show date and relevant status, print. | /reports shares personnel rules and supports personnel report printing and exports. Custody counts use employee IDs. |
| Logs | Concern form with employee, category, priority, assignee and details. Update status and resolution date. Salary change form with grade/step, effective date, reference, and reason. | /logs records concerns and resolutions, records append-only salary changes, and offers audit history to permitted roles. |
| School settings | School name, region/division, ID, school head, administrative officer, disbursing officer, inventory chair, superintendent, COA auditor, preparer, reference date, reporting year, and demo logo upload/save. | /settings saves identity, signatories, rules, and private logo. /settings/access assigns existing Auth accounts roles. |

## Personnel forms and printing

The prototype only implements a Certificate of Employment preview and print dialog. The other listed forms and the NOSI Print control are demonstrations. School Admin Desk prepares and saves versioned drafts using the appropriate employee, school identity and signatories, record data, and the fields of the selected draft template. The school needs to confirm the official wording, eligibility, fields, and signatures for each form.

| Prototype group | Forms |
| --- | --- |
| Personnel requests | Service Record, Leave Form (CSC Form 6), Authority to Travel, Certificate of Employment, Locator Slip, Request for Service Credit / COC, Certificate of Appearance, 4Ps Certification |
| Maternity leave | CSC Medical Certificate, School Level Clearance |
| Financial | Modification Advice, Waiver of Responsibility, Advice of Checks Issued, Schedule of Funds |
| Division reports | Transmittal Form, Total Personnel Report, Physical Count of PPE |
| Retirement | District Level Clearance, Pendency / Non-Pendency, SALN |
| Personnel tools | Notice of Step Increment (NOSI), 201 checklist |

Drafts are available from /forms, including older records in the saved-drafts pages. The certificate includes employee, issue date and purpose. The property PPE form opens the matching inventory report. Browser printing supports saving to PDF, while personnel exports are available from Reports.

## Property and inventory

The prototype groups Office Supplies, Learning Resources, ICT Equipment, Science and Math, Sports Equipment, TLE Equipment, SHS Equipment, Office Equipment, WINS / Clinic, DRRM, School Building, Furniture and Fixtures, Donation, Canteen Property, and Equipment over ₱50K. School Admin Desk lists these and other configured categories in **Inventory categories**. Each category link retains the current inventory view and search. Choosing a category also surfaces its transaction and report shortcuts. The categories use a common ledger and item masterlist.

| Prototype section | Interactions and content | Application |
| --- | --- | --- |
| Property overview and module dashboards | Aggregate value, item condition, employee accountability, recent activity, quick links, and designated signatories. | /inventory shows totals, category values, condition, custody, low stock, and recent activity. Focused links open the matching inventory filters. |
| Databases | Find name or code, add and edit an item, delete, inspect beginning/current quantity and value, view classification and module details, and print one/all tags. XLSX export, backup CSV and XLSX import were toast-only controls. | Masterlist and item detail use the same categories, item codes, balances, classifications, and detail fields. Documented edits and archive preserve history. XLSX import and XLSX/CSV export use the masterlist. Opening balances enter the ledger as receipts. |
| RIS, ICS, PAR | Choose an employee/date, add lines, select item/quantity, preview unit/cost/total/classification, save and print. | Issue posts under a stable employee ID. The form number, item details, school identity, and costs are saved together in a draft transaction snapshot. Receipt, return, adjustment, and disposal entries have corresponding document references. |
| Issued and returned | Report issued, returned, outstanding and recipient. Choose an issue and return a partial or full quantity. | History ties each return to its original issue line. Clearance custody excludes consumable RIS issues. Invalid stock reductions and excess returns are rejected. |
| RSMI and stock card | Aggregate RIS lines; select a stock item and inspect beginning/receipt/issue/balance and reorder point. | Printed RSMI uses ledger issue records. A stock card is available from item details and displays balance changes. |
| RPCI, RPCPPE and Annex A | Record units on hand separately from property card, inspect shortage/overage quantities and values, enter accountable staff/location, and print the count. | A count saves physical and recorded quantities at the time of counting. The reports show recorded variances and allow printing. |
| IIRUP and Waste Materials | Mark serviceability, select disposal method, inspect value. Enter waste material quantity, unit, O.R. and amount, add rows and save/print. | Item condition and ledger disposal drive the reports. Disposal requires a method and reference. Official receipt and proceeds can be saved with the disposal document and included in the Waste Materials report. |
| Building Card and NSBI | Select building, edit building type, completion year, storeys, rooms, floor area, funding, lot/title and condition, and print its card or consolidated report. | Building detail fields live on the common item record. The building card and NSBI draft use the building category and recorded school settings. |
| Science and Math Annex 1 / Property Form No. 1 | Consolidated delivery certification, delivery receipt number, quantities and values, print. | Annex 1 derives lines from recorded receipts, with category and date filters and a printed delivery reference. |

The school still needs to select and verify the official versions of the forms, including Annex A, Annex 1/Property Form No. 1, Waste Materials and building templates. The implemented reports and printed documents represent school-review drafts. Review and approval are school-level decisions. Inventory issue and disposal posting and personnel draft generation are available to authorized staff, with no in-app approval queue. A printed issue, return or disposal can be recreated from its stored transaction snapshot. Reprinting a live aggregate or physical-count report uses the current underlying records for the selected filters.
