// src/services/companyService.js
// ─────────────────────────────────────────────────────────────
// Company Profile Page — API Service
// Backend: Java Spring Boot REST API
// Database: PostgreSQL
// ─────────────────────────────────────────────────────────────

import API from "@shared/api/http";


// ═════════════════════════════════════════════════════════════
// 1. COMPANY SERVICE
//    Spring Boot Controller: /api/company
//    PostgreSQL Table: companies
// ═════════════════════════════════════════════════════════════
export const companyService = {

  
  get: () => {
    return API.get("/company");
  },

  
  update: (data) => {
    return API.put("/company", data);
  },

  // ── UPLOAD COMPANY LOGO ────────────────────────────────────
  // POST /api/company/logo
  // @PostMapping("/api/company/logo")
  // public ResponseEntity<CompanyDTO> uploadLogo(@RequestParam("file") MultipartFile file)
  //
  // Accepts: JPG, JPEG, PNG, SVG, GIF — max 2MB
  // Returns updated CompanyDTO with new logoUrl (stored in S3 / local storage)
  uploadLogo: (file) => {
    const formData = new FormData();
    formData.append("file", file);
    return API.post("/company/logo", formData, {
      headers: { "Content-Type": "multipart/form-data" },
    });
  },

  // ── UPLOAD COMPANY FAVICON ─────────────────────────────────
  // POST /api/company/favicon
  // @PostMapping("/api/company/favicon")
  // public ResponseEntity<CompanyDTO> uploadFavicon(@RequestParam("file") MultipartFile file)
  //
  // Accepts: ICO, PNG — max 2MB
  // Returns updated CompanyDTO with new faviconUrl
  uploadFavicon: (file) => {
    const formData = new FormData();
    formData.append("file", file);
    return API.post("/company/favicon", formData, {
      headers: { "Content-Type": "multipart/form-data" },
    });
  },

  // ── GET SUBSCRIPTION INFO ──────────────────────────────────
  // GET /api/company/subscription
  // @GetMapping("/api/company/subscription")
  // public ResponseEntity<SubscriptionDTO> getSubscription()
  //
  // Returns:
  // { plan, startDate, endDate, status, daysLeft, features }
  getSubscription: () => {
    return API.get("/company/subscription");
  },

  // ── GET AI CREDITS ─────────────────────────────────────────
  // GET /api/company/ai-credits
  // @GetMapping("/api/company/ai-credits")
  // public ResponseEntity<AiCreditsDTO> getAiCredits()
  //
  // Returns: { used, total, usedCost }
  getAiCredits: () => {
    return API.get("/company/ai-credits");
  },
};


// ═════════════════════════════════════════════════════════════
// 2. TAX RATE SERVICE
//    Spring Boot Controller: /api/tax-rates
//    PostgreSQL Table: tax_rates
// ═════════════════════════════════════════════════════════════
export const taxRateService = {

  // ── GET ALL TAX RATES ──────────────────────────────────────
  // GET /api/tax-rates
  // @GetMapping("/api/tax-rates")
  // public ResponseEntity<List<TaxRateDTO>> getAll()
  //
  // Returns all tax rates ordered by effective_from DESC.
  // Response:
  // [
  //   {
  //     id: 1,
  //     type: "GST",
  //     rate: 0.0,
  //     calculation: "Additive",
  //     effectiveFrom: "2026-05-29",
  //     description: "Standard GST",
  //     isActive: true,
  //     createdAt: "2026-05-29T10:00:00Z"
  //   },
  //   ...
  // ]
  getAll: () => {
    return API.get("/tax-rates");
  },

  // ── GET ACTIVE TAX RATES ONLY ──────────────────────────────
  // GET /api/tax-rates/active
  // @GetMapping("/api/tax-rates/active")
  // public ResponseEntity<List<TaxRateDTO>> getActive()
  getActive: () => {
    return API.get("/tax-rates/active");
  },

  // ── CREATE TAX RATE ────────────────────────────────────────
  // POST /api/tax-rates
  // @PostMapping("/api/tax-rates")
  // public ResponseEntity<TaxRateDTO> create(@RequestBody TaxRateDTO dto)
  //
  // Request body:
  // {
  //   type: "GST",              // GST | TCS | TDS | Service Tax | VAT | Other
  //   rate: 5.0,                // decimal
  //   calculation: "Additive",  // Additive | Inclusive | Exclusive
  //   effectiveFrom: "2026-06-18",
  //   description: "Budget 2026 rate"
  // }
  //
  // Backend logic: automatically sets previous active rate of
  // same type to inactive (effective_to = effectiveFrom - 1 day)
  create: (data) => {
    return API.post("/tax-rates", data);
  },

  // ── DELETE TAX RATE ────────────────────────────────────────
  // DELETE /api/tax-rates/{id}
  // @DeleteMapping("/api/tax-rates/{id}")
  // public ResponseEntity<Void> delete(@PathVariable Long id)
  delete: (id) => {
    return API.delete(`/tax-rates/${id}`);
  },

  // ── GET TAX RATE BY ID ─────────────────────────────────────
  // GET /api/tax-rates/{id}
  // @GetMapping("/api/tax-rates/{id}")
  // public ResponseEntity<TaxRateDTO> getById(@PathVariable Long id)
  getById: (id) => {
    return API.get(`/tax-rates/${id}`);
  },
};


// ═════════════════════════════════════════════════════════════
// DEFAULT EXPORT
// ═════════════════════════════════════════════════════════════
export default { companyService, taxRateService };
// ─────────────────────────────────────────────────────────────