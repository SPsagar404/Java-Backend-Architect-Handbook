
# Part 16: Spring Security Interview Questions (100+)

## Fundamentals (Q1-Q20)

**Q1. What is Spring Security?**
A powerful, customizable authentication and access-control framework for Spring-based applications. Provides comprehensive security services for Java EE applications including authentication, authorization, and protection against common exploits.

**Q2. What is the difference between authentication and authorization?**
Authentication (AuthN): Verifying identity ("Who are you?"). Authorization (AuthZ): Verifying permissions ("What can you do?"). Authentication happens first; authorization happens after successful authentication.

**Q3. What is the SecurityFilterChain?**
A chain of servlet filters that process every incoming HTTP request. Each filter handles a specific security concern (CSRF, authentication, authorization). Configured via `HttpSecurity` in a `@Configuration` class.

**Q4. What is SecurityContextHolder?**
A holder class that stores the `SecurityContext`, which contains the `Authentication` object of the currently authenticated user. Uses ThreadLocal by default, so authentication is available throughout the request lifecycle.

**Q5. What is the default authentication mechanism in Spring Security?**
Form-based login with a generated password. Spring Boot auto-generates a password on startup and provides a default login page at `/login`.

**Q6. How does Spring Security store passwords?**
Using `PasswordEncoder`. The recommended encoder is `BCryptPasswordEncoder`, which uses BCrypt hashing with a random salt. Passwords are never stored as plain text.

**Q7. What is CSRF and how does Spring Security handle it?**
Cross-Site Request Forgery: an attacker tricks a user's browser into making unwanted requests. Spring Security includes a CSRF token in forms and validates it on submission. Disabled for stateless REST APIs (JWT-based).

**Q8. What is CORS?**
Cross-Origin Resource Sharing: a browser mechanism that allows/restricts requests from different origins. Configure in Spring Security with `CorsConfigurationSource` to whitelist allowed origins, methods, and headers.

**Q9. What is the difference between `@Secured` and `@PreAuthorize`?**
`@Secured`: simple role check, no SpEL support (`@Secured("ROLE_ADMIN")`). `@PreAuthorize`: supports Spring Expression Language for complex conditions (`@PreAuthorize("hasRole('ADMIN') and #id == authentication.principal.id")`). `@PreAuthorize` is more powerful and recommended.

**Q10. What is the `UserDetailsService` interface?**
Core interface that loads user-specific data. Has a single method: `loadUserByUsername(String username)` that returns a `UserDetails` object. Implementation typically queries the database.

**Q11. What is the `UserDetails` interface?**
Represents the authenticated user. Contains: username, password, authorities, and account status flags (expired, locked, enabled). Custom implementations wrap your domain User entity.

**Q12. What is `GrantedAuthority`?**
Represents a permission/role granted to the user. Stored as a string (e.g., "ROLE_ADMIN", "user:read"). Retrieved from `Authentication.getAuthorities()`.

**Q13. What is the `AuthenticationManager`?**
Central interface for authentication. Receives an `Authentication` request and returns a fully populated `Authentication` if successful. Default implementation is `ProviderManager`.

**Q14. What is an `AuthenticationProvider`?**
Performs the actual authentication logic. The `AuthenticationManager` delegates to one or more providers. `DaoAuthenticationProvider` is the most common (uses `UserDetailsService` + `PasswordEncoder`).

**Q15. How to disable Spring Security for certain endpoints?**
Use `.requestMatchers("/public/**").permitAll()` in the `SecurityFilterChain` configuration. This allows unauthenticated access to matching URLs.

**Q16. What is session fixation attack?**
An attacker sets a known session ID on the victim's browser before they log in. After login, the attacker uses the same session ID to hijack the session. Spring Security mitigates this by creating a new session on authentication.

**Q17. What is `DelegatingPasswordEncoder`?**
A `PasswordEncoder` that supports multiple encoding formats. Prefixes the hash with the algorithm: `{bcrypt}$2a$10$...`. Useful for migrating from one hashing algorithm to another.

**Q18. What is method-level security?**
Securing individual methods with annotations. Enabled with `@EnableMethodSecurity`. Annotations: `@PreAuthorize` (before), `@PostAuthorize` (after), `@Secured`, `@RolesAllowed`.

**Q19. What HTTP status codes does Spring Security return?**
401 Unauthorized: authentication required or failed. 403 Forbidden: authenticated but insufficient permissions. These are handled by `AuthenticationEntryPoint` and `AccessDeniedHandler`.

**Q20. What is the difference between `hasRole` and `hasAuthority`?**
`hasRole("ADMIN")` checks for `ROLE_ADMIN` (auto-prefixes "ROLE_"). `hasAuthority("ROLE_ADMIN")` checks for the exact string. `hasAuthority` is also used for fine-grained permissions like `user:read`.

## JWT and Token Security (Q21-Q40)

**Q21. What is JWT?**
JSON Web Token: a compact, self-contained token format (Header.Payload.Signature). Contains user claims, signed with a secret key. Used for stateless authentication in REST APIs.

**Q22. What are the three parts of a JWT?**
Header (algorithm + type), Payload (claims: subject, roles, expiration), Signature (HMAC or RSA signature for integrity verification).

**Q23. Where should JWT be stored on the client?**
HttpOnly cookies (most secure, immune to XSS). localStorage is convenient but vulnerable to XSS attacks. Never store in URL parameters.

**Q24. What is the difference between access token and refresh token?**
Access token: short-lived (15 min), used for API authentication. Refresh token: long-lived (7 days), used only to obtain new access tokens. Refresh tokens should be stored securely and can be revoked.

**Q25. How to revoke a JWT?**
JWTs are self-contained and can't be modified after issuance. Options: 1) Short expiry (damage window limited). 2) Token blacklist in Redis. 3) Token versioning (increment version on logout). 4) Refresh token rotation.

**Q26. What is token rotation?**
When a refresh token is used, issue both a new access token AND a new refresh token. Invalidate the old refresh token. If the old token is reused, revoke all tokens for that user (indicates theft).

**Q27. What signing algorithms are used for JWT?**
HS256 (HMAC-SHA256): symmetric, same key for signing and verification. RS256 (RSA-SHA256): asymmetric, private key signs, public key verifies. RS256 is preferred for distributed systems (microservices can verify without the private key).

**Q28. How does JWT authentication work in Spring Security?**
Custom `OncePerRequestFilter` extracts JWT from Authorization header, validates signature, extracts username, loads `UserDetails`, creates `Authentication` token, and sets it in `SecurityContextHolder`.

**Q29. What happens when a JWT expires?**
The server returns 401. The client uses its refresh token to obtain a new access token from the `/auth/refresh` endpoint. If the refresh token is also expired, the user must re-login.

**Q30. What is the `jti` claim in JWT?**
JWT ID: a unique identifier for the token. Used to prevent replay attacks and implement token revocation (blacklist by jti instead of the entire token string).

**Q31. How to implement "logout" with JWT?**
Since JWT is stateless: 1) Client deletes the token. 2) Add token to server-side blacklist (Redis) with TTL equal to remaining expiry time. 3) Invalidate the refresh token in database.

**Q32. What is the difference between symmetric and asymmetric JWT signing?**
Symmetric (HMAC): same secret key for signing and verifying. Simpler but secret must be shared with all validators. Asymmetric (RSA/ECDSA): private key signs, public key verifies. More secure for distributed systems.

**Q33. How to handle JWT in a microservices architecture?**
Auth Service generates JWT. API Gateway validates JWT on every request. Downstream services either trust the gateway (read user headers) or re-validate the JWT.

**Q34. What is a JWK (JSON Web Key)?**
A JSON representation of a cryptographic key. Used with asymmetric JWT. Auth server publishes public keys at a JWK endpoint. Resource servers fetch keys to verify tokens.

**Q35. What security risks does JWT have?**
Token theft (XSS/network), no server-side revocation, payload is only Base64 encoded (not encrypted), algorithm confusion attacks. Mitigate with short expiry, HttpOnly cookies, HTTPS, and explicit algorithm verification.

**Q36. What is the difference between JWT and opaque tokens?**
JWT: self-contained, no server lookup needed, larger size. Opaque: random string, requires server lookup (introspection), smaller size, easier revocation. OAuth2 can use either.

**Q37. How to pass additional information in JWT?**
Add custom claims to the payload: roles, permissions, tenant ID, organization. Keep payload small to minimize token size. Never include sensitive data (passwords, SSN).

**Q38. What is token introspection?**
An OAuth2 endpoint where resource servers can verify if an opaque token is active. The auth server returns token metadata (active, scope, expiry). Used when tokens are not self-contained.

**Q39. How to test JWT authentication?**
Use `@WithMockUser` for unit tests. For integration tests, generate a valid JWT in the test setup. Use `SecurityMockMvcRequestPostProcessors.jwt()` with Spring Security test support.

**Q40. What is the `nbf` (Not Before) claim?**
Specifies the time before which the token must not be accepted. Used to issue tokens for future use. If current time < nbf, token is rejected.

## OAuth2 (Q41-Q55)

**Q41. What is OAuth2?**
An authorization framework that allows third-party applications to obtain limited access to a user's resources without sharing credentials. Delegates authentication to an authorization server.

**Q42. What are the four OAuth2 roles?**
Resource Owner (user), Client (application), Authorization Server (issues tokens), Resource Server (hosts protected resources).

**Q43. What is the Authorization Code flow?**
Most secure flow for web apps. User is redirected to auth server, logs in, auth server returns authorization code, client exchanges code for tokens server-side. The code is short-lived and single-use.

**Q44. What is the Client Credentials flow?**
Machine-to-machine authentication. Client sends its own credentials (client_id + client_secret) directly to get an access token. No user involvement. Used for service-to-service communication.

**Q45. What is the difference between OAuth2 and OpenID Connect?**
OAuth2 is for authorization (accessing resources). OpenID Connect (OIDC) is an identity layer on top of OAuth2 for authentication (knowing who the user is). OIDC adds an ID token with user information.

**Q46. What is an ID token vs access token?**
ID token: contains user identity information (name, email), intended for the client app. Access token: used to access protected APIs, intended for the resource server. ID tokens are JWT; access tokens can be opaque.

**Q47. What is a scope in OAuth2?**
Defines the level of access requested. Examples: `openid`, `profile`, `email`, `read:orders`. The user must consent to the requested scopes. The auth server includes granted scopes in the token.

**Q48. What is Spring Authorization Server?**
A framework for building OAuth2 Authorization Servers with Spring Security. Supports authorization code, client credentials, refresh token, and device authorization grants.

**Q49. What is Keycloak?**
An open-source identity and access management solution. Provides OAuth2, OIDC, SAML, and social login out of the box. Commonly used as the authorization server in Spring microservices.

**Q50. How to configure Spring Boot as an OAuth2 Resource Server?**
```yaml
spring:
  security:
    oauth2:
      resourceserver:
        jwt:
          issuer-uri: http://keycloak:8080/realms/myapp
```
This auto-configures JWT validation using the issuer's public keys.

**Q51. What is PKCE (Proof Key for Code Exchange)?**
An extension to the Authorization Code flow for public clients (mobile/SPA). The client generates a code_verifier, sends a code_challenge to the auth server, and proves possession of the verifier when exchanging the code.

**Q52. What is token exchange?**
An OAuth2 extension where a service exchanges one token for another with different scope or audience. Used in microservices when Service A needs to call Service B on behalf of the user.

**Q53. What is the refresh token grant?**
Uses a refresh token to obtain a new access token without re-authentication. The auth server validates the refresh token and issues a new access token (and optionally a new refresh token).

**Q54. How does "Login with Google" work in Spring Boot?**
Configure Google as an OAuth2 client in application.yml. Spring Security redirects to Google's consent page. After consent, Google redirects back with a code. Spring exchanges the code for tokens and loads user info.

**Q55. What is multi-tenancy in OAuth2?**
Supporting multiple organizations/tenants in one application. Each tenant may have its own auth server or realm. Implemented by dynamically resolving the issuer based on the request.

## Architecture and Production (Q56-Q80)

**Q56. How to implement RBAC in Spring Security?**
Define roles in database. Map roles to authorities. Use `@PreAuthorize("hasRole('ADMIN')")` for method security and `.hasRole("ADMIN")` for URL security. Load authorities in `UserDetailsService`.

**Q57. What is the filter chain execution order?**
SecurityContextPersistenceFilter -> CsrfFilter -> LogoutFilter -> AuthenticationFilter -> ExceptionTranslationFilter -> AuthorizationFilter. Custom filters can be added before/after any filter.

**Q58. How to configure multiple SecurityFilterChains?**
Define multiple `@Bean SecurityFilterChain` methods with `@Order`. Lower order = higher priority. Use `securityMatcher` to scope each chain to specific URLs.

**Q59. What is the `OncePerRequestFilter`?**
A filter base class that guarantees a single execution per request. Used for custom filters like JWT authentication. Prevents duplicate filter execution in forwarded requests.

**Q60. How to secure WebSocket connections?**
Configure `WebSocketSecurityConfigurer`. Authenticate during the WebSocket handshake. Use STOMP message-level authorization for individual message types.

**Q61. How to implement password reset flow?**
User requests reset, generate a time-limited token (UUID), store hash in DB, email the link. On reset, validate token, hash new password with BCrypt, invalidate the token.

**Q62. How to implement account lockout?**
Track failed login attempts per user. After N failures, set `locked = true`. Unlock after a timeout or manual admin action. Check `isAccountNonLocked()` in `UserDetails`.

**Q63. What is the `ExceptionTranslationFilter`?**
Catches security exceptions. Translates `AuthenticationException` to 401 (via `AuthenticationEntryPoint`). Translates `AccessDeniedException` to 403 (via `AccessDeniedHandler`).

**Q64. How to implement remember-me authentication?**
`http.rememberMe()` generates a persistent token stored in a cookie. Spring validates the token on subsequent requests. Use `PersistentTokenBasedRememberMeServices` for production (tokens stored in DB).

**Q65. How to secure actuator endpoints?**
`.requestMatchers("/actuator/**").hasRole("ADMIN")` or restrict to specific endpoints. In production, expose only health and info endpoints. Use separate security chain with higher priority.

**Q66. What is HSTS (HTTP Strict Transport Security)?**
A security header that tells browsers to always use HTTPS. Spring Security adds this by default. Prevents SSL stripping attacks. Configuration: `headers.httpStrictTransportSecurity()`.

**Q67. How to prevent brute force attacks?**
Rate limiting per IP/user. Account lockout after N failures. CAPTCHA after repeated failures. Login attempt logging and alerting. Exponential backoff on failed attempts.

**Q68. What is content negotiation in security?**
Returning different error formats based on the Accept header. For browser requests: redirect to login page. For API requests: return JSON 401 error. Configured in `AuthenticationEntryPoint`.

**Q69. How to implement audit logging for security events?**
Listen to Spring Security events: `AuthenticationSuccessEvent`, `AuthenticationFailureBadCredentialsEvent`, `AuthorizationDeniedEvent`. Use `@EventListener` to log to database or monitoring system.

**Q70. What is the `SecurityContextRepository`?**
Interface that controls how `SecurityContext` is stored between requests. `HttpSessionSecurityContextRepository` (default) stores in session. For stateless: use `RequestAttributeSecurityContextRepository`.

**Q71. How to test Spring Security?**
Use `@WithMockUser(roles = "ADMIN")` for mock authentication. Use `SecurityMockMvcRequestPostProcessors` for MockMvc tests. Use `@SpringBootTest` for integration tests with real security config.

**Q72. What is the `AbstractSecurityInterceptor`?**
Base class that performs authorization checks. Intercepts method/URL access, uses `AccessDecisionManager` to vote on whether access should be granted. Replaced by `AuthorizationManager` in Spring Security 6.

**Q73. How to configure security for different API versions?**
Use `securityMatcher("/api/v1/**")` and `securityMatcher("/api/v2/**")` on separate `SecurityFilterChain` beans with `@Order`. Each version can have different authentication requirements.

**Q74. How to implement IP-based access control?**
Use `hasIpAddress("192.168.1.0/24")` in the security config. Or create a custom filter that checks request IP against an allowlist. Useful for admin endpoints.

**Q75. What is the `AuthenticationSuccessHandler`?**
Invoked after successful authentication. Customizes post-login behavior: redirect URL, response body (JWT), audit logging, session attribute setup.

**Q76. How to secure file uploads?**
Validate file type (whitelist extensions), check file size, scan for malware, store outside web root, generate random filenames, set Content-Disposition header on download.

**Q77. What is Spring Security ACL?**
Access Control List: domain object security. Controls access to individual objects (e.g., "User 1 can edit Document 42 but not Document 43"). More granular than role-based security.

**Q78. How to implement API key authentication?**
Create a custom filter that reads the API key from a header (`X-API-Key`). Validate against stored keys in database. Create an `Authentication` object for the API key owner.

**Q79. What is mTLS (Mutual TLS)?**
Both client and server present X.509 certificates. The server validates the client's certificate. Used for service-to-service authentication in microservices. Configured in Spring with `spring.ssl.bundles`.

**Q80. How to rotate JWT signing keys?**
Use key identifiers (`kid` in JWT header). Publish multiple keys at the JWK endpoint. Sign new tokens with the new key. Verify tokens using the `kid` to select the correct key. Remove old keys after their tokens expire.

## Advanced & Architect-Level (Q81-Q105)

**Q81. Design a security architecture for a microservices system.**
API Gateway validates JWT. Auth Service issues tokens. Each service extracts user from JWT/headers. RBAC at service level. mTLS for service-to-service. Secrets in Vault. Rate limiting at Gateway.

**Q82. How to implement SSO across multiple applications?**
Central auth server (Keycloak). All apps redirect to the same auth server. Session cookie at the auth server domain. Once logged in to one app, the auth server recognizes the session for other apps.

**Q83. Design a multi-tenant security system.**
Tenant ID in JWT claims. Tenant resolver extracts tenant from request (subdomain, header, JWT). Data isolation: tenant column in tables or separate databases. Security filter adds tenant context.

**Q84. How to implement field-level security?**
Use `@PostFilter` to filter collection results. Use `@JsonView` with security-aware views. Or use DTO mappers that check permissions before including sensitive fields.

**Q85. What is the principle of least privilege?**
Users and services should have only the minimum permissions needed. Default deny all, explicitly grant. Regular permission audits. Avoid wildcard permissions.

**Q86. How to implement dynamic authorization rules?**
Store rules in database. Custom `AuthorizationManager` loads rules at runtime. Update rules without redeployment. Cache rules with TTL for performance.

**Q87. How to secure event-driven systems?**
Sign Kafka messages with producer credentials. Validate consumer authorization. Encrypt sensitive payloads. Audit message processing. Use SASL/SSL for Kafka connections.

**Q88. What is zero trust security?**
Never trust, always verify. Every request is authenticated and authorized regardless of network location. No implicit trust for internal services. mTLS everywhere. Continuous validation.

**Q89. How to implement consent management?**
Track what data the user has consented to share. Store consent records per user per scope. Check consent before returning data. Provide consent revocation API. GDPR compliance.

**Q90. Design a secure password reset flow.**
1. User enters email. 2. Generate cryptographically random token. 3. Store token hash in DB with 15-min expiry. 4. Email link with token. 5. User clicks link, enters new password. 6. Validate token, hash new password, delete token. 7. Invalidate all existing sessions.

**Q91. How to implement security in GraphQL?**
Authenticate at the HTTP level (JWT filter). Authorize at the resolver level using `@PreAuthorize` or custom directives. Limit query depth and complexity to prevent DoS.

**Q92. What security considerations for WebSockets?**
Authenticate during handshake. Validate authorization per message. Rate limit messages. Validate message content. Close idle connections. Prevent CSWSH (Cross-Site WebSocket Hijacking).

**Q93. How to implement security headers best practices?**
Content-Security-Policy, X-Content-Type-Options, X-Frame-Options, Strict-Transport-Security, Referrer-Policy, Permissions-Policy. Spring Security's `headers()` configures most automatically.

**Q94. How to handle security in blue-green deployments?**
Both versions must accept the same JWT signing key. Share the same auth server. Token blacklists must be shared (Redis). Session stores must be shared during transition.

**Q95. Design an audit logging system for security events.**
Log: who (user), what (action), when (timestamp), where (IP, service), result (success/failure). Store in append-only database. Tamper detection with checksums. Retention policy per compliance requirements.

**Q96. How to implement device fingerprinting?**
Collect device attributes (browser, OS, screen, timezone). Hash into a fingerprint. Store known devices per user. Alert on unknown device login. Require MFA for new devices.

**Q97. What is a security token service (STS)?**
A service that issues, validates, and renews security tokens. Central point for token management. Implements OAuth2 Authorization Server. Handles token lifecycle.

**Q98. How to implement data encryption at rest?**
Database-level encryption (TDE). Application-level field encryption for sensitive fields (SSN, credit card). Use JCA/JCE for encryption. Manage keys in Vault or KMS.

**Q99. How to secure configuration and secrets?**
Never hardcode secrets. Use environment variables or Vault. Encrypt application.yml sensitive values with Jasypt. Rotate secrets regularly. Use Kubernetes Secrets with encryption at rest.

**Q100. What is the OWASP Top 10 and how does Spring Security address it?**
Injection (parameterized queries), Broken Auth (Spring Security framework), Sensitive Data Exposure (HTTPS/encryption), XXE (disable external entities), Broken Access Control (RBAC), Security Misconfig (secure defaults), XSS (content security headers), Insecure Deserialization (type validation), Components with Vulnerabilities (dependency scanning), Insufficient Logging (audit events).

**Q101. How to implement step-up authentication?**
Allow basic access with standard auth. For sensitive operations (transfer money), require additional authentication (password re-entry, MFA). Implement as a custom filter or `@PreAuthorize` check.

**Q102. Design a centralized authorization service.**
Standalone service managing all permissions. Expose API: `POST /authorize { userId, resource, action }`. Decision caching at service level. Policy-based rules (OPA/Casbin). Event-driven policy updates.

**Q103. How to implement API versioning with security?**
Each API version can have different security requirements. Use separate `SecurityFilterChain` per version. Deprecate authentication methods with version migration. Support backwards compatibility.

**Q104. What is threat modeling?**
Systematic process to identify and address security threats. Techniques: STRIDE (Spoofing, Tampering, Repudiation, Information Disclosure, Denial of Service, Elevation of Privilege). Apply to each microservice.

**Q105. How to prepare for a security audit?**
Document authentication flows. Map all API endpoints with their authorization requirements. Verify password policies. Review dependency vulnerabilities. Check compliance requirements (GDPR, PCI-DSS). Provide audit logs.

---

# Part 17: Hands-on Practice Exercises

## Exercise 1: Build JWT Authentication System

**Goal:** Create a complete JWT auth system from scratch.

```java
// Step 1: User entity + Role entity
// Step 2: UserRepository + RoleRepository
// Step 3: CustomUserDetails + CustomUserDetailsService
// Step 4: JwtService (generate/validate tokens)
// Step 5: JwtAuthenticationFilter
// Step 6: SecurityConfig
// Step 7: AuthController (login/register/refresh)
// Step 8: Test with Postman

// Expected endpoints:
// POST /api/auth/register -> 201 + tokens
// POST /api/auth/login    -> 200 + tokens
// POST /api/auth/refresh  -> 200 + new access token
// GET  /api/users/me      -> 200 + user data (requires JWT)
```

## Exercise 2: Implement OAuth2 Login with Google

```yaml
# application.yml
spring:
  security:
    oauth2:
      client:
        registration:
          google:
            client-id: ${GOOGLE_CLIENT_ID}
            client-secret: ${GOOGLE_CLIENT_SECRET}
            scope: openid, profile, email
```

```java
// Step 1: Register app in Google Developer Console
// Step 2: Configure application.yml
// Step 3: Create CustomOAuth2UserService
// Step 4: Create OAuth2 success handler (generate JWT after Google login)
// Step 5: Test: visit /oauth2/authorization/google
```

## Exercise 3: Implement Role-Based Authorization

```java
// Step 1: Create roles table with ADMIN, USER, MANAGER
// Step 2: Assign roles to users via user_roles table
// Step 3: Configure URL-based security:

.requestMatchers("/api/admin/**").hasRole("ADMIN")
.requestMatchers("/api/reports/**").hasAnyRole("ADMIN", "MANAGER")
.requestMatchers("/api/profile/**").authenticated()

// Step 4: Configure method-level security:
@PreAuthorize("hasRole('ADMIN')")
public void deleteUser(Long userId) { ... }

@PreAuthorize("#userId == authentication.principal.id or hasRole('ADMIN')")
public User getUser(Long userId) { ... }

// Step 5: Test each role accessing each endpoint
```

## Exercise 4: Implement Refresh Token Rotation

```java
// Step 1: Create RefreshToken entity with: token, userId, expiryDate, revoked
// Step 2: On login: generate access + refresh tokens, store refresh in DB
// Step 3: On refresh:
//   a. Validate refresh token exists and not expired
//   b. Generate new access token + new refresh token
//   c. Revoke old refresh token
//   d. Return new tokens
// Step 4: On logout:
//   Revoke all refresh tokens for the user

@Entity
public class RefreshToken {
    @Id @GeneratedValue
    private Long id;
    private String token;
    private Long userId;
    private Instant expiryDate;
    private boolean revoked;
}
```

## Exercise 5: Build Rate Limiting Filter

```java
// Step 1: Create a filter that extends OncePerRequestFilter
// Step 2: Track requests per IP using a ConcurrentHashMap + timestamps
// Step 3: Allow max 100 requests per minute per IP
// Step 4: Return 429 Too Many Requests when limit exceeded
// Step 5: Register filter in SecurityFilterChain
// Step 6: Test with rapid API calls

@Component
public class RateLimitFilter extends OncePerRequestFilter {
    private final Map<String, List<Long>> requests = new ConcurrentHashMap<>();

    @Override
    protected void doFilterInternal(HttpServletRequest req,
            HttpServletResponse res, FilterChain chain)
            throws ServletException, IOException {
        String ip = req.getRemoteAddr();
        long now = System.currentTimeMillis();
        requests.computeIfAbsent(ip, k -> new ArrayList<>())
                .removeIf(t -> now - t > 60000);
        if (requests.get(ip).size() >= 100) {
            res.setStatus(429);
            res.getWriter().write("{\"error\":\"Rate limit exceeded\"}");
            return;
        }
        requests.get(ip).add(now);
        chain.doFilter(req, res);
    }
}
```

## Exercise 6: Implement Account Lockout

```java
// Step 1: Add loginAttempts and lockedUntil fields to User entity
// Step 2: On failed login: increment loginAttempts
// Step 3: After 5 failures: set lockedUntil = now + 30 minutes
// Step 4: On login attempt: check if account is locked
// Step 5: On successful login: reset loginAttempts

@EventListener
public void onAuthFailure(AuthenticationFailureBadCredentialsEvent event) {
    String email = (String) event.getAuthentication().getPrincipal();
    User user = userRepository.findByEmail(email).orElse(null);
    if (user != null) {
        user.setLoginAttempts(user.getLoginAttempts() + 1);
        if (user.getLoginAttempts() >= 5) {
            user.setLockedUntil(LocalDateTime.now().plusMinutes(30));
        }
        userRepository.save(user);
    }
}
```

## Exercise 7: Secure Microservices Architecture

```
// Step 1: Create Auth Service (issues JWT)
// Step 2: Create API Gateway (validates JWT, routes requests)
// Step 3: Create Order Service (reads user from headers)
// Step 4: Create User Service (RBAC on endpoints)
// Step 5: Implement Feign client that propagates JWT
// Step 6: Test end-to-end flow:
//   Login -> Get JWT -> Call Order Service via Gateway
//   -> Order Service calls User Service with propagated JWT
```

## Exercise 8: Implement Audit Logging

```java
// Step 1: Create AuditLog entity (user, action, ip, timestamp, result)
// Step 2: Listen to Spring Security events:

@Component
public class SecurityAuditListener {
    @Autowired private AuditLogRepository auditRepo;

    @EventListener
    public void onSuccess(AuthenticationSuccessEvent event) {
        auditRepo.save(new AuditLog(
            event.getAuthentication().getName(),
            "LOGIN_SUCCESS", getClientIp(), LocalDateTime.now()));
    }

    @EventListener
    public void onFailure(AbstractAuthenticationFailureEvent event) {
        auditRepo.save(new AuditLog(
            (String) event.getAuthentication().getPrincipal(),
            "LOGIN_FAILED", getClientIp(), LocalDateTime.now()));
    }
}
```

## Exercise 9: Implement CORS for Multiple Frontends

```java
// Step 1: Configure allowed origins for different environments
// Step 2: Allow specific methods (GET, POST, PUT, DELETE)
// Step 3: Allow Authorization and Content-Type headers
// Step 4: Test from different origins

@Bean
public CorsConfigurationSource corsConfig() {
    CorsConfiguration config = new CorsConfiguration();
    config.setAllowedOrigins(List.of(
        "http://localhost:3000",       // Dev frontend
        "https://app.mycompany.com",   // Production
        "https://admin.mycompany.com"  // Admin portal
    ));
    config.setAllowedMethods(List.of("GET","POST","PUT","DELETE","OPTIONS"));
    config.setAllowedHeaders(List.of("Authorization","Content-Type"));
    config.setAllowCredentials(true);
    UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
    source.registerCorsConfiguration("/api/**", config);
    return source;
}
```

## Exercise 10: Implement Custom Authentication Provider

```java
// Step 1: Create a custom AuthenticationProvider
// Step 2: Authenticate against an external API or custom logic
// Step 3: Register in SecurityConfig

@Component
public class ApiKeyAuthProvider implements AuthenticationProvider {
    @Autowired private ApiKeyRepository apiKeyRepo;

    @Override
    public Authentication authenticate(Authentication auth)
            throws AuthenticationException {
        String apiKey = (String) auth.getCredentials();
        ApiKeyEntity key = apiKeyRepo.findByKeyValue(apiKey)
            .orElseThrow(() -> new BadCredentialsException("Invalid API key"));

        if (!key.isActive() || key.getExpiresAt().isBefore(Instant.now())) {
            throw new BadCredentialsException("API key expired");
        }

        return new UsernamePasswordAuthenticationToken(
            key.getOwner(), null,
            List.of(new SimpleGrantedAuthority("ROLE_API_CLIENT")));
    }

    @Override
    public boolean supports(Class<?> authentication) {
        return ApiKeyAuthenticationToken.class.isAssignableFrom(authentication);
    }
}
```

---

*End of Guide*

**Document Version:** 1.0
**Last Updated:** March 2026
**Topics Covered:** 17 Parts, 105 Interview Questions, 10 Hands-on Exercises
