// src/features/customers/index.js
// Public API of the customers feature.

export { default as AllCustomers } from "./pages/AllCustomers";
export { default as Createcustomer } from "./pages/Createcustomer";
// Alternate compact UI kept for future reference:
// export { default as Createcustomer } from "./pages/CreateCustomerClean";
export { default as EditCustomer } from "./pages/EditCustomer";
export { default as CustomerDetails } from "./pages/CustomerDetails";
export { default as customerService } from "./api/customerService";
