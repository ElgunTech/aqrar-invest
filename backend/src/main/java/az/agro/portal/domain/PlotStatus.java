package az.agro.portal.domain;

public enum PlotStatus {
    AVAILABLE("Sərbəst"),
    IN_COMPETITION("Müsabiqədə"),
    ASSIGNED("Təhvil verilib");

    private final String label;

    PlotStatus(String label) {
        this.label = label;
    }

    public String getLabel() {
        return label;
    }
}
