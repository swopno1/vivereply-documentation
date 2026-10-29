# Stock Movements — Overview

**Pages:** `/admin/inventory/move?kind=RECEIVE|ISSUE|WASTE`
**Audience:** storekeeper (primary).
**Prerequisite:** the Inventory module.

Every movement of stock in or out of the main store goes through one of
three kinds. All three allow **several items at once**, post **together**
(nothing half-saves), and record quantities to three decimals. Any line
worth more than ৳1 crore is rejected — recheck quantity and price.

| Kind | Page | Meaning |
|---|---|---|
| **RECEIVE** | [Receive Stock](receive/) | A delivery into the store — what arrived, at what price |
| **ISSUE** | [Issue Stock](issue/) | Stock leaving the store for a department |
| **WASTE** | [Record Waste](waste/) | Spoiled, broken, expired — with a reason |

**The discipline that prevents reconciliation pain:** record movements when
they happen. Receiving "tomorrow" or issuing "from memory" is how book and
shelf drift apart — and the drift is discovered at count time, as your
variance.
