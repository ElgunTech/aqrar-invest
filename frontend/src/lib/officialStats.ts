/**
 * Results of the real land-lease investment competitions in the liberated territories, as presented by the
 * Ministry of Agriculture (KTN). Static figures: the portal's own numbers are demo data, these are the official ones.
 */
export const OFFICIAL = {
  source: "Kənd Təsərrüfatı Nazirliyi, müsabiqələrin nəticələri üzrə təqdimat",
  offeredHa: 42905,
  districts: 9,
  competitions: 4,
  participants: 521,
  winners: 212,
  contracts: 141,
  leasedHa: 15254,
  /** Leased area (ha) and minimum investment commitment (₼) per district. */
  byDistrict: [
    { name: "Qubadlı", ha: 4881, invest: 69574110 },
    { name: "Xocavənd", ha: 3936, invest: 80158892.3 },
    { name: "Xocalı", ha: 1739.5, invest: 20635402 },
    { name: "Füzuli", ha: 1593, invest: 5551828 },
    { name: "Ağdərə", ha: 1539.29, invest: 8813285 },
    { name: "Cəbrayıl", ha: 600, invest: 700900 },
    { name: "Ağdam", ha: 498.84, invest: 10462103 },
    { name: "Laçın", ha: 349.35, invest: 11160171 },
    { name: "Zəngilan", ha: 116.44, invest: 4165417 },
  ],
};
