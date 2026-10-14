package az.agro.portal.domain;

public enum DocumentType {
    BUSINESS_PLAN("Biznes plan"),
    ID_DOCUMENT("Şəxsiyyət vəsiqəsi"),
    REGISTRATION_CERT("Dövlət qeydiyyatı şəhadətnaməsi"),
    FINANCIAL_PROOF("Maliyyə imkanını təsdiq edən sənəd"),
    OTHER("Digər sənəd");

    private final String label;

    DocumentType(String label) {
        this.label = label;
    }

    public String getLabel() {
        return label;
    }
}
