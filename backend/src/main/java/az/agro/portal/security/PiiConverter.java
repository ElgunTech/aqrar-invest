package az.agro.portal.security;

import jakarta.persistence.AttributeConverter;
import jakarta.persistence.Converter;

/** JPA converter: personal-data columns are stored encrypted and read back as plain text. */
@Converter
public class PiiConverter implements AttributeConverter<String, String> {

    @Override
    public String convertToDatabaseColumn(String attribute) {
        return PiiCrypto.encrypt(attribute);
    }

    @Override
    public String convertToEntityAttribute(String dbData) {
        return PiiCrypto.decrypt(dbData);
    }
}
