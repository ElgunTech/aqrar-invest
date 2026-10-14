package az.agro.portal.domain;

public enum Role {
    INVESTOR("Sahibkar"),
    EVALUATOR("Qiymətləndirici"),
    ADMIN("Administrator");

    private final String label;

    Role(String label) {
        this.label = label;
    }

    public String getLabel() {
        return label;
    }
}
