package az.agro.portal.domain;

public enum IntegrationEventStatus {
    PENDING("Növbədə"),
    SENT("Göndərilib"),
    FAILED("Xəta"),
    RECEIVED("Qəbul edilib");

    private final String label;

    IntegrationEventStatus(String label) {
        this.label = label;
    }

    public String getLabel() {
        return label;
    }
}
