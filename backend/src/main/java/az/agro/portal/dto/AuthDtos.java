package az.agro.portal.dto;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

public final class AuthDtos {

    private AuthDtos() {
    }

    public record LoginRequest(@NotBlank @Email String email, @NotBlank String password) {
    }

    public record RegisterRequest(
            @NotBlank @Size(max = 150) String fullName,
            @NotBlank @Email @Size(max = 120) String email,
            @Pattern(regexp = "^$|^[+0-9 ()-]{9,20}$", message = "Telefon nömrəsi yanlışdır") String phone,
            @Pattern(regexp = "^$|^[A-Za-z0-9]{7}$", message = "FİN 7 simvoldan ibarət olmalıdır") String fin,
            @NotBlank @Size(min = 8, max = 100, message = "Şifrə ən azı 8 simvol olmalıdır")
            @Pattern(regexp = "^(?=.*[A-Za-z])(?=.*\\d).+$", message = "Şifrədə həm hərf, həm rəqəm olmalıdır") String password) {
    }

    public record MyGovCallback(@NotBlank String code, @NotBlank String state) {
    }

    public record UserDto(Long id, String email, String fullName, String role, String roleLabel, String phone, String taxId, long unreadNotifications) {
    }
}
