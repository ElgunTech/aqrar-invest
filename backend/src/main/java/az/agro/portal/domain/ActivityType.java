package az.agro.portal.domain;

public enum ActivityType {
    CROP_FARMING("Əkinçilik"),
    LIVESTOCK("Heyvandarlıq"),
    HORTICULTURE("Bağçılıq"),
    VITICULTURE("Üzümçülük"),
    GREENHOUSE("İstixana təsərrüfatı"),
    BEEKEEPING("Arıçılıq");

    private final String label;

    ActivityType(String label) {
        this.label = label;
    }

    public String getLabel() {
        return label;
    }
}
