package az.agro.portal.domain;

import jakarta.persistence.*;

import java.time.Instant;
import java.time.LocalDate;

/** An agricultural land plot offered to investors. */
@Entity
@Table(name = "land_plot")
public class LandPlot {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    /** Portal code, e.g. QR-AGD-001. */
    @Column(nullable = false, unique = true, length = 30)
    private String code;

    /** State cadastre number — the natural key for EKTİS / cadastre integration. */
    @Column(length = 40)
    private String cadastreNumber;

    @Column(nullable = false, length = 150)
    private String title;

    @Column(nullable = false, length = 60)
    private String district;

    @Column(length = 80)
    private String village;

    private double latitude;
    private double longitude;

    /** Area in hectares. */
    private double areaHa;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 30)
    private ActivityType activityType;

    @Column(length = 80)
    private String soilType;

    // Soil & climate indicators (also the AI model's input features)
    private double nitrogen;
    private double phosphorus;
    private double potassium;
    private double ph;
    private double avgTemperature;
    private double humidity;
    private double rainfall;

    // Infrastructure
    private double waterSourceKm;
    private double roadKm;
    private boolean irrigationAvailable;
    private boolean electricityAvailable;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private MineClearanceStatus mineClearance;

    private LocalDate mineClearanceDate;

    /** Lease term in years. */
    private int leaseYears;

    /** Minimum required investment, AZN. */
    private long minInvestment;

    @Column(length = 2000)
    private String usageTerms;

    @Column(length = 2000)
    private String description;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private PlotStatus status = PlotStatus.AVAILABLE;

    /** Real boundary (GeoJSON geometry, WGS84) from the ANAMA certified-areas dataset. */
    @Column(columnDefinition = "text")
    private String boundaryGeoJson;

    /** ANAMA minefield / task identifier of the certified area, e.g. Az-2637. */
    @Column(length = 30)
    private String anamaRef;

    private LocalDate clearanceStartDate;

    /** Where the plot geometry comes from (shown to users). */
    @Column(length = 300)
    private String dataSource;

    private Instant createdAt = Instant.now();
    private Instant updatedAt = Instant.now();

    @PreUpdate
    void touch() {
        updatedAt = Instant.now();
    }

    public Long getId() { return id; }
    public String getCode() { return code; }
    public void setCode(String code) { this.code = code; }
    public String getCadastreNumber() { return cadastreNumber; }
    public void setCadastreNumber(String cadastreNumber) { this.cadastreNumber = cadastreNumber; }
    public String getTitle() { return title; }
    public void setTitle(String title) { this.title = title; }
    public String getDistrict() { return district; }
    public void setDistrict(String district) { this.district = district; }
    public String getVillage() { return village; }
    public void setVillage(String village) { this.village = village; }
    public double getLatitude() { return latitude; }
    public void setLatitude(double latitude) { this.latitude = latitude; }
    public double getLongitude() { return longitude; }
    public void setLongitude(double longitude) { this.longitude = longitude; }
    public double getAreaHa() { return areaHa; }
    public void setAreaHa(double areaHa) { this.areaHa = areaHa; }
    public ActivityType getActivityType() { return activityType; }
    public void setActivityType(ActivityType activityType) { this.activityType = activityType; }
    public String getSoilType() { return soilType; }
    public void setSoilType(String soilType) { this.soilType = soilType; }
    public double getNitrogen() { return nitrogen; }
    public void setNitrogen(double nitrogen) { this.nitrogen = nitrogen; }
    public double getPhosphorus() { return phosphorus; }
    public void setPhosphorus(double phosphorus) { this.phosphorus = phosphorus; }
    public double getPotassium() { return potassium; }
    public void setPotassium(double potassium) { this.potassium = potassium; }
    public double getPh() { return ph; }
    public void setPh(double ph) { this.ph = ph; }
    public double getAvgTemperature() { return avgTemperature; }
    public void setAvgTemperature(double avgTemperature) { this.avgTemperature = avgTemperature; }
    public double getHumidity() { return humidity; }
    public void setHumidity(double humidity) { this.humidity = humidity; }
    public double getRainfall() { return rainfall; }
    public void setRainfall(double rainfall) { this.rainfall = rainfall; }
    public double getWaterSourceKm() { return waterSourceKm; }
    public void setWaterSourceKm(double waterSourceKm) { this.waterSourceKm = waterSourceKm; }
    public double getRoadKm() { return roadKm; }
    public void setRoadKm(double roadKm) { this.roadKm = roadKm; }
    public boolean isIrrigationAvailable() { return irrigationAvailable; }
    public void setIrrigationAvailable(boolean irrigationAvailable) { this.irrigationAvailable = irrigationAvailable; }
    public boolean isElectricityAvailable() { return electricityAvailable; }
    public void setElectricityAvailable(boolean electricityAvailable) { this.electricityAvailable = electricityAvailable; }
    public MineClearanceStatus getMineClearance() { return mineClearance; }
    public void setMineClearance(MineClearanceStatus mineClearance) { this.mineClearance = mineClearance; }
    public LocalDate getMineClearanceDate() { return mineClearanceDate; }
    public void setMineClearanceDate(LocalDate mineClearanceDate) { this.mineClearanceDate = mineClearanceDate; }
    public int getLeaseYears() { return leaseYears; }
    public void setLeaseYears(int leaseYears) { this.leaseYears = leaseYears; }
    public long getMinInvestment() { return minInvestment; }
    public void setMinInvestment(long minInvestment) { this.minInvestment = minInvestment; }
    public String getUsageTerms() { return usageTerms; }
    public void setUsageTerms(String usageTerms) { this.usageTerms = usageTerms; }
    public String getDescription() { return description; }
    public void setDescription(String description) { this.description = description; }
    public PlotStatus getStatus() { return status; }
    public void setStatus(PlotStatus status) { this.status = status; }
    public String getBoundaryGeoJson() { return boundaryGeoJson; }
    public void setBoundaryGeoJson(String boundaryGeoJson) { this.boundaryGeoJson = boundaryGeoJson; }
    public String getAnamaRef() { return anamaRef; }
    public void setAnamaRef(String anamaRef) { this.anamaRef = anamaRef; }
    public LocalDate getClearanceStartDate() { return clearanceStartDate; }
    public void setClearanceStartDate(LocalDate clearanceStartDate) { this.clearanceStartDate = clearanceStartDate; }
    public String getDataSource() { return dataSource; }
    public void setDataSource(String dataSource) { this.dataSource = dataSource; }
    public Instant getCreatedAt() { return createdAt; }
    public Instant getUpdatedAt() { return updatedAt; }
}
