# Part 16: Architect-Level Security Interview Questions (100+)

## 1. Fundamentals & Spring Internals (Questions 1-20)

**Q1. How does a Servlet Filter (which Tomcat runs) know about a Spring Bean like your custom JwtFilter?**
*Architect's Answer:* Tomcat doesn't know about Spring. Spring bridges this gap using `DelegatingFilterProxy`, which is registered as a standard Servlet Filter but delegates all work to the `FilterChainProxy` Spring Bean, which subsequently houses our internal Security Filter Chains.

*Deep Explanation:* When Spring Boot starts, `SecurityFilterAutoConfiguration` registers `DelegatingFilterProxy` with the embedded Servlet Container. This proxy looks up a bean named `springSecurityFilterChain` from the Spring `ApplicationContext`. That bean is `FilterChainProxy`, which maintains a `List<SecurityFilterChain>`. For each request, `FilterChainProxy` iterates through the list and finds the first chain whose `securityMatcher()` matches the request URL.

*Real-World Impact:* This means if an exception is thrown inside the filter chain (before `DispatcherServlet`), your `@ControllerAdvice` will NOT catch it. You must handle security exceptions within the filter chain using `AuthenticationEntryPoint` and `AccessDeniedHandler`.

---

**Q2. In a highly concurrent REST API, how does Spring ensure one thread doesn't read the SecurityContext of another thread?**
*Architect's Answer:* The `SecurityContextHolder` utilizes the `ThreadLocal` strategy. This binds the context securely to the executing thread.

*Deep Explanation:* Tomcat allocates a thread from its thread pool for each incoming HTTP request. `SecurityContextHolder` uses `ThreadLocal<SecurityContext>`, which gives each thread its own isolated copy. Even if 1,000 requests arrive simultaneously, Thread-1's `SecurityContext` (User A) is completely invisible to Thread-2's `SecurityContext` (User B).

*Production Scenario:* In a banking app handling 5,000 concurrent transactions, ThreadLocal guarantees that User A's account balance query never accidentally uses User B's authentication credentials.

---

**Q3. If I spawn a heavy background task using `@Async`, why do I suddenly lose my Authentication object? How do you fix it?**
*Architect's Answer:* Because `@Async` spawns a new thread, and the `SecurityContext` is bound strictly to `ThreadLocal`. You fix it by wrapping your `Executor` or `ThreadPoolTaskExecutor` in a `DelegatingSecurityContextExecutorService`, which automatically copies the Context into the new thread before execution.

*Real-World Scenario:* An e-commerce platform sends order confirmation emails asynchronously. The email template includes "Dear {username}". Without context propagation, `SecurityContextHolder.getContext().getAuthentication()` returns `null` in the async thread, causing a `NullPointerException`.

*Monolithic Fix:*
```java
@Bean
public Executor asyncExecutor() {
    ThreadPoolTaskExecutor executor = new ThreadPoolTaskExecutor();
    executor.initialize();
    return new DelegatingSecurityContextExecutor(executor);
}
```

*Microservices Fix:* When publishing events to Kafka, serialize the JWT string into the Kafka message header. The consumer service extracts and validates the JWT to restore the SecurityContext.

---

**Q4. What is the difference between `AuthenticationManager` and `AuthenticationProvider`?**
*Architect's Answer:* `AuthenticationManager` uses the Strategy Pattern. Its default implementation (`ProviderManager`) loops through a list of registered `AuthenticationProviders`. This allows a single application to support DB Login (`DaoAuthProvider`), API Key Login (`ApiKeyAuthProvider`), and OAuth2 simultaneously.

*Deep Explanation:* The `AuthenticationManager` interface has one method: `authenticate(Authentication)`. The `ProviderManager` (its main implementation) iterates through its list of `AuthenticationProvider`s, calling `provider.supports(tokenType)` on each one. Only providers that support the given token type attempt authentication. If none succeed, a `ProviderNotFoundException` is thrown.

---

**Q5. Why should you never use `MD5` or `SHA-256` for password hashing? Why is `BCrypt` the standard?**
*Architect's Answer:* Standard hashing algorithms are fast by design, making them vulnerable to Rainbow Table dictionaries and GPU Brute Forcing. BCrypt embeds a random 22-character salt (thwarting rainbow tables) and intentionally slows down the hashing process (e.g., via 4096 iterations) to mathematically prevent brute-force attacks from scaling.

*Numbers that matter:*
- MD5: 10 billion hashes/second on a modern GPU → cracked in seconds
- SHA-256: 8 billion hashes/second → cracked in seconds
- BCrypt (strength 12): 8 hashes/second → cracking 1 password takes years

---

**Q6. How do you migrate a legacy system consisting of 1 Million `MD5` user passwords to `BCrypt` with zero downtime?**
*Architect's Answer:* Use `DelegatingPasswordEncoder`. Set `BCrypt` as the default for new signups. Register the `MD5` encoder as a fallback. When a user logs in successfully using their legacy `MD5` password in memory, rewrite the password to DB immediately using `BCrypt`.

*Step-by-Step Migration:*
1. Database stores: `{MD5}5f4dcc3b5aa765d...` (old) and `{bcrypt}$2a$12$...` (new)
2. User logs in with password "secret123"
3. Spring sees `{MD5}` prefix → uses MD5 encoder to verify
4. Verification succeeds → Spring calls `UserDetailsPasswordService.updatePassword()`
5. Password is re-hashed: `{bcrypt}$2a$12$...` and saved to database
6. Next login: Spring uses BCrypt directly (MD5 never touched again)

---

**Q7. Explain the exact difference between Authentication (AuthN) and Authorization (AuthZ).**
*Architect's Answer:* Authentication asks: "Who are you?" (proving identity via passwords/MFA). Authorization asks: "What are you allowed to do?" (checking Roles, Scopes, and Authorities). AuthN always precedes AuthZ.

*Production Example:*
In a hospital system:
- AuthN: Dr. Smith presents her badge + PIN → system confirms she IS Dr. Smith
- AuthZ: Dr. Smith tries to access Patient X's records → system checks if Dr. Smith is assigned to Patient X → if NOT, access denied (403), despite valid authentication

---

**Q8. What happens internally when you call `http.cors().configurationSource(..)`?**
*Architect's Answer:* Spring injects a `CorsFilter` *before* the security checks. When a browser sends an HTTP `OPTIONS` preflight request (which inherently lacks an Authentication header), the `CorsFilter` intercepts it. If configured correctly, it responds with a 200 OK allowing the CORS flow, preventing the `AnonymousAuthenticationFilter` from rejecting the preflight request with a 401.

*Common Production Bug:* Developer configures CORS on the `@RestController` using `@CrossOrigin` but forgets that Spring Security's filter chain runs BEFORE the controller. The preflight OPTIONS request hits the security chain first and gets a 401 because it has no Authorization header.

*Fix:* Always configure CORS at the `SecurityFilterChain` level using `http.cors(cors -> cors.configurationSource(...))`, not at the controller level.

---

**Q9. If you build a completely Stateless REST API utilizing JWTs, do you need CSRF protection?**
*Architect's Answer:* No. CSRF (Cross-Site Request Forgery) attacks rely on browsers automatically attaching `JSESSIONID` Cookies to forged requests. If you use stateless JWTs sent explicitly via the HTTP `Authorization: Bearer` header, the browser won't auto-send the token. You can safely `.disable()` CSRF.

*But be careful:* If you store the JWT in a Cookie (instead of the Authorization header), CSRF protection is STILL needed because browsers auto-attach cookies! The decision depends on WHERE you store the token:
- In-memory JavaScript variable / Authorization header → CSRF disabled ✓
- HttpOnly Cookie → CSRF enabled ✓ (use `CookieCsrfTokenRepository`)

---

**Q10. How does the `ExceptionTranslationFilter` handle security errors?**
*Architect's Answer:* It acts as a safety net catching exceptions thrown deeper in the chain. If an `AuthenticationException` is caught, it triggers the `AuthenticationEntryPoint` (translating to a 401 HTTP response). If an `AccessDeniedException` is caught, it triggers the `AccessDeniedHandler` (translating to a 403 HTTP response).

*Production Impact:* If you don't customize these handlers for a REST API, Spring defaults to returning an HTML login page for 401 errors. Your SPA/mobile app receives HTML instead of JSON → crashes.

---

## 2. JWT Architecture & OIDC (Questions 21-40)

**Q11. Explain the architectural flaw of using Symmetric Signatures (HS256) for a JWT in a microservices ecosystem.**
*Architect's Answer:* Symmetric keys (`HMAC-SHA256`) use the exact same secret key to sign the token (Auth Server) and verify the token (Resource Server). If an attacker breaches any single downstream microservice and reads the secret key from `application.yml`, they can forge valid "ADMIN" JWTs and compromise the entire cluster.

*Monolithic vs Microservices:*
- Monolithic: HS256 is acceptable because only ONE application holds the secret
- Microservices: HS256 is dangerous because the secret must be shared across all services

---

**Q12. What is the solution? Explain JWKS and RS256.**
*Architect's Answer:* Use Asymmetric cryptography (`RS256`). The Auth Server holds the strictly guarded **Private Key** to sign the JWTs. The Auth server publishes the **Public Keys** via a JSON Web Key Set (JWKS) endpoint. Downstream Spring Boot APIs fetch the JWKS. If the downstream microservice is breached, the attacker only gets the Public Key, which cannot forge tokens.

*Spring Boot Config (Zero secrets in downstream services):*
```yaml
spring:
  security:
    oauth2:
      resourceserver:
        jwt:
          jwk-set-uri: https://auth-service/.well-known/jwks.json
```

---

**Q13. How do you implement Zero-Downtime Key Rotation using JWKS?**
*Architect's Answer:* Generate a new Private/Public key pair. Add the new Public Key to the JWKS endpoint alongside the old one. The Auth Server starts signing new tokens with the new Private Key, explicitly setting the `kid` (Key ID) in the JWT Header. Spring Boot APIs see the new `kid`, fetch the updated JWKS, and continue validating. Once all old tokens expire, remove the old key from the JWKS list.

*Why `kid` (Key ID) matters:* The JWT header contains `"kid": "key-2024-03"`. When a microservice receives this JWT, it checks its cached JWKS for a key with this `kid`. If not found, it fetches the JWKS endpoint again. This is how Spring auto-discovers new keys without any deployment!

---

**Q14. In OAuth2, what is the architectural distinction between a Role and a Scope?**
*Architect's Answer:* A **Role** (e.g. `ROLE_ADMIN`) is inherent to the User (RBAC), answering "What is this user allowed to do inside the API?". A **Scope** (e.g. `read:orders`) dictates what the *Client Application* is authorized to do *on behalf* of the user. Spring Security enforces scopes via `@PreAuthorize("hasAuthority('SCOPE_read:orders')")`.

*Production Example:* A user is an ADMIN in the CRM. Zapier integration has only `read:contacts` scope. Even though the user IS an admin, Zapier cannot delete contacts because the OAuth2 scope doesn't include `write:contacts`.

---

**Q15. Is OAuth2 an Authentication Protocol? Explain.**
*Architect's Answer:* No, OAuth2 is purely a delegated **Authorization** framework. It allows a third-party app to access resources without sharing credentials. For actual **Authentication** (identity proving), we use **OpenID Connect (OIDC)**, an identity layer built on top of OAuth2 that provides an `ID Token` (JWT) containing user profiling data.

*Key Difference:*
- OAuth2 Access Token: `{ scope: "read:calendar" }` → "This app can read your calendar" (Authorization)
- OIDC ID Token: `{ sub: "user123", name: "John", email: "j@mail.com" }` → "This IS John" (Authentication)

---

**Q16. How do you revoke a stateless JWT before its expiration?**
*Architect's Answer:* A JWT is cryptographically valid until its `exp` claim hits. The only way to securely revoke it early is to push its `jti` (JWT ID) to a highly available, high-speed distributed cache like Redis (with a TTL matching the token's remaining lifespan). The `JwtFilter` must assert `!redisTemplate.hasKey(jti)` on every request.

*Alternative for emergency mass-revocation:* Rotate the JWT signing key. All existing tokens become cryptographically invalid instantly. Every user must re-authenticate.

---

**Q17. Why do we pair short-lived Access Tokens with long-lived Refresh Tokens?**
*Architect's Answer:* Because checking Redis on every request to see if an Access Token is revoked kills the performance of a stateless architecture. By making Access Tokens expire in 10 minutes, we limit the damage window if a token is stolen. The frontend uses the secure Refresh Token to silently request new Access Tokens. We only hit Redis to revoke Refresh Tokens upon explicit "Logout" requests.

*Architect's Math:*
- 50,000 requests/second × 1 Redis check per request = 50,000 Redis ops/second (expensive!)
- With short-lived access tokens: Redis only checked on refresh (every 10 minutes) = ~80 checks/second (negligible)

---

**Q18. What is Token Replay, and how do you prevent it?**
*Architect's Answer:* An attacker intercepts a valid JWT and resends the exact same HTTP request to execute the action twice (e.g. transferring money). Mitigate this by enforcing **Idempotency Keys** on `POST` requests, preventing the server from processing the same transaction UUID twice.

*Implementation:*
```java
@PostMapping("/transfer")
public ResponseEntity<TransferResult> transfer(
    @RequestHeader("X-Idempotency-Key") String idempotencyKey,
    @RequestBody TransferRequest request) {
    
    // Check if this exact transaction was already processed
    if (redisTemplate.hasKey("idempotency:" + idempotencyKey)) {
        return ResponseEntity.ok(cachedResult);
    }
    // Process transaction and cache the result
}
```

---

**Q19. What is a "Confidential Client" vs a "Public Client" in OAuth2?**
*Architect's Answer:* A Confidential Client (e.g., a Spring Boot Backend) can securely store a `client_secret` out of reach of the user. A Public Client (e.g., a React SPA or iOS app) cannot securely hold secrets, as the code is delivered to the user's device. Public clients must use the **Authorization Code Flow with PKCE** to prove identity without a static secret.

*Why PKCE (Proof Key for Code Exchange):*
Without PKCE, if an attacker intercepts the Authorization Code during the redirect, they can exchange it for tokens. PKCE adds a dynamically generated `code_verifier` (random string) → hashed into `code_challenge`. The Auth Server verifies the code_verifier matches the code_challenge. The attacker cannot forge this because they never saw the original code_verifier.

---

**Q20. How does the Client Credentials flow differ from Authorization Code flow?**
*Architect's Answer:* The Client Credentials flow is for Machine-to-Machine (Service-to-Service) communication where there is no human user involved. A backend service authenticates itself using its own `client_id` and `client_secret` to obtain a token.

*Example:* Order Service calls Payment Service at 2 AM for a scheduled batch refund. No user is logged in. Order Service uses its own `client_id`/`client_secret` to get a machine-level token with `payment:refund` scope.

---

## 3. Production & Zero-Trust Architecture (Questions 41-60)

**Q21. Explain Perimeter Security vs Zero-Trust Architecture.**
*Architect's Answer:* Perimeter Security trusts any traffic that originates from inside the internal network (VPC/VPN). Zero Trust assumes the network is already breached. Every single request, even those between internal Microservices running on the same Kubernetes Node, must be cryptographically authenticated and authorized.

*Real-World Breach:* In 2020, the SolarWinds attack demonstrated why Perimeter Security fails. Attackers compromised an internal network monitoring tool. Because internal traffic was trusted, the attackers moved laterally across thousands of systems undetected. With Zero-Trust, each service-to-service call would have required separate authentication.

---

**Q22. How do you implement internal security using an API Gateway Pattern?**
*Architect's Answer:* The Gateway (e.g. Spring Cloud Gateway) parses and validates the JWT against the Keycloak JWKS server. If valid, the Gateway strips the JWT and attaches internal HTTP Headers (`X-User-Id`, `X-Roles`) before routing downstream. The downstream microservices *implicitly trust* the Gateway. Not strict Zero-Trust, but highly performant.

*Security Warning:* If an attacker can bypass the Gateway (e.g., via Kubernetes port-forward, misconfigured ingress, or a compromised internal service), they can spoof the `X-User-Id` header and impersonate any user!

---

**Q23. How do you implement internal security using a Service Mesh/Zero-Trust Pattern?**
*Architect's Answer:* The Gateway blindly forwards the raw HTTP `Authorization: Bearer <jwt>` Header downstream. Every single internal Microservice is configured as a Spring Security `OAuth2ResourceServer`. Every microservice independently fetches the JWKS and cryptographically verifies the signature before processing the request. This represents strict Zero-Trust.

---

**Q24. What is Mutual TLS (mTLS), and why is it required in true Zero-Trust?**
*Architect's Answer:* Standard TLS encrypts traffic, but only the Client verifies the Server's certificate. In Mutual TLS, BOTH the Client and the Server present certificates. When Microservice A calls Microservice B, they establish a cryptographically secure, encrypted tunnel proving each other's identities at the transport layer, effectively preventing Network Sniffing inside the VPC. Usually handled by Istio/Envoy sidecars.

*How Istio implements mTLS:*
- Istio injects an Envoy sidecar proxy into every Kubernetes pod
- When Pod A calls Pod B, their Envoy sidecars handle the mTLS handshake
- Spring Boot is completely unaware — it thinks it's making plain HTTP calls
- The application code doesn't change AT ALL

---

**Q25. How do you implement Session Fixation defense in a monolithic, session-based app?**
*Architect's Answer:* When a user authenticates successfully, immediately invalidate their pre-login `JSESSIONID` and generate a completely new, cryptographically random `JSESSIONID`. Spring Security handles this natively via `sessionFixation().migrateSession()`.

---

**Q26. How do you prevent a user from logging into the same account simultaneously from 10 different laptops?**
*Architect's Answer:* Register a `SessionRegistry` bean and configure `.sessionManagement().maximumSessions(1)`. Note: If deployed across multiple EC2 instances behind a Load Balancer, local memory execution fails. You must implement Spring Session backed by a centralized Redis cluster (`@EnableRedisHttpSession`).

---

**Q27. Design a Spring Security RBAC system to authorize access based on dynamic database attributes (ABAC).**
*Architect's Answer:* Utilize Aspect-Oriented Method Security via `@PreAuthorize`. Instead of a static role check, use SpEL to enforce Attribute-Based Access Control logic executing before the DAO method: `@PreAuthorize("hasRole('ADMIN') or #document.ownerId == authentication.principal.id")`.

*Advanced Scenario:* In a document management system, a manager can only delete documents created by employees in their own department:
```java
@PreAuthorize("hasRole('MANAGER') and @departmentService.isInSameDept(authentication.principal.id, #docId)")
public void deleteDocument(Long docId) { ... }
```

---

**Q28. What is an OAuth2 "Token Exchange" in a microservices ecosystem?**
*Architect's Answer:* When Service A receives a user JWT and needs to call Service B. Instead of passing the user's raw token, Service A calls the Auth Server to exchange the token for a new token scoped *specifically* for Service B, limiting access privileges (Defense in Depth).

*Why not just forward the original token?*
If Order Service receives a token with scopes `[order:read, order:write, payment:read, user:admin]` and forwards it to Payment Service, Payment Service sees ALL scopes, even ones irrelevant to payments. Token Exchange narrows the scope to only `[payment:read]`.

---

**Q29. What happens if your Spring Boot app's `application.yml` contains `spring.security.oauth2.resourceserver.jwt.jwk-set-uri`, but the Keycloak server crashes?**
*Architect's Answer:* Spring Security caches the JWKS public keys. If Keycloak crashes, Spring Security can continue to securely validate incoming JWTs independently until the cache TTL expires or a token requires a new `kid` signature.

*Production Resilience Tip:* Configure JWKS cache timeout to a reasonable value (e.g., 1 hour). This ensures your API remains operational even if the Auth Server has brief downtime. But also monitor Keycloak health checks aggressively to catch outages early.

---

**Q30. Explain the concept of "Defense in Depth" as applied to Spring Security.**
*Architect's Answer:* Do not rely entirely on one layer of security. Use HSTS Headers for transport safety. Use the API Gateway for rate limiting and coarse Token validation. Use Spring Security Method Annotations (`@PreAuthorize`) for fine-grained row-level business logic. Use mTLS for VPC tunneling. If the API Gateway is misconfigured, mTLS and internal RBAC annotations will catch the intruder.

*The 5 Layers:*
```
Layer 1: Network (AWS Security Groups, VPC, WAF)
Layer 2: Transport (HTTPS/TLS, mTLS for internal communication)
Layer 3: API Gateway (Rate limiting, IP blocking, JWT validation)
Layer 4: Application (Spring Security FilterChain, CORS, CSRF)
Layer 5: Business Logic (@PreAuthorize, data-level authorization, audit logging)
```

---

## 4. Advanced System Design Security Questions (Questions 61-80)

**Q31. Design an authentication system that can handle 1 million concurrent users.**
*Architect's Answer:*
```
Architecture:
  - Auth Service: 5 instances behind NLB, connected to PostgreSQL (primary + read replicas)
  - JWT with RS256: Auth Service signs tokens with private key
  - Access Token TTL: 10 minutes (stateless, no server-side storage)
  - Refresh Token: Stored in Redis cluster (3 nodes, high availability)
  - All other microservices: Validate JWT with cached JWKS public key
  - Zero Redis calls for normal API requests (only during token refresh)
  
Capacity Math:
  - 1M concurrent users × 1 request/sec = 1M requests/second
  - Each request: JWT validation via cached public key = ~1ms CPU (no I/O)
  - No database call per request (stateless JWT)
  - Redis hit only during refresh: 1M users / 600 seconds = ~1,600 refreshes/second
```

---

**Q32. How would you design a multi-tenant security system where tenants can customize their own RBAC?**
*Architect's Answer:*
```
Design:
  - Each tenant has its own set of Roles and Permissions in the database
  - TenantAwareUserDetails carries tenantId
  - A @PreAuthorize custom evaluator loads tenant-specific permissions
  - The SecurityContext is enriched with tenant-level authorities
  
Implementation:
  @PreAuthorize("@tenantAuthz.hasPermission(authentication, 'order:delete')")
  
  @Component
  public class TenantAuthz {
    public boolean hasPermission(Authentication auth, String permission) {
      Long tenantId = ((TenantUserDetails) auth.getPrincipal()).getTenantId();
      return permissionRepo.existsByTenantIdAndUserIdAndPermission(
        tenantId, auth.getName(), permission);
    }
  }
```

---

**Q33. How do you secure internal APIs so that only specific microservices can call them?**
*Architect's Answer:* Use OAuth2 Client Credentials with service-specific scopes. Order Service gets a token with scope `payment:process`. User Service gets a token with scope `user:read`. Payment Service validates: `@PreAuthorize("hasAuthority('SCOPE_payment:process')")`. Even if the User Service is compromised, it cannot call payment APIs because its token doesn't have the right scope.

---

**Q34. How would you implement security audit logging for compliance (SOC2, HIPAA)?**
*Architect's Answer:*
```java
@Component
public class SecurityAuditListener {
    
    @Autowired private AuditLogRepository auditRepo;
    
    @EventListener
    public void onSuccess(AuthenticationSuccessEvent event) {
        auditRepo.save(AuditLog.builder()
            .event("LOGIN_SUCCESS")
            .userId(event.getAuthentication().getName())
            .ip(extractIp(event))
            .timestamp(Instant.now())
            .build());
    }
    
    @EventListener
    public void onFailure(AbstractAuthenticationFailureEvent event) {
        auditRepo.save(AuditLog.builder()
            .event("LOGIN_FAILURE")
            .userId((String) event.getAuthentication().getPrincipal())
            .reason(event.getException().getMessage())
            .ip(extractIp(event))
            .timestamp(Instant.now())
            .build());
    }
}
```

---

**Q35. How do you handle token expiration gracefully in a Single Page Application?**
*Architect's Answer:* Implement a Silent Refresh mechanism. The Axios/Fetch interceptor catches 401 responses. Before showing an error, it calls the `/refresh` endpoint with the refresh token cookie. If successful, the original request is retried with the new access token. If the refresh also fails (token expired), redirect to the login page. The user never sees the intermediate 401.

---

## 5. Scenario-Based Interview Questions (Questions 81-100+)

**Q36. Your production API is returning 403 for an admin user. How do you debug this?**
*Architect's Debugging Process:*
```
1. Enable debug logging: logging.level.org.springframework.security=DEBUG
2. Check logs for: "Checking authorization for GET /api/admin/users"
3. Look for: "Granted Authorities: [ROLE_admin]" — note the casing!
4. The config uses: hasRole("ADMIN") which looks for "ROLE_ADMIN"
5. Database stores: "admin" (lowercase), authority becomes "ROLE_admin"
6. Fix: Either store "ADMIN" in DB or use hasRole("admin")
7. ALTERNATIVE FIX: Use case-insensitive comparison in custom voter
```

---

**Q37. Your React SPA can't call the Spring Boot API. The browser console shows "CORS preflight failed."**
*Architect's Debugging Process:*
```
1. Check: Is the CORS configured at SecurityFilterChain level?
   (.cors(cors -> cors.configurationSource(...)) — NOT @CrossOrigin on controller)
2. Check: Does the CorsConfiguration include OPTIONS in allowedMethods?
3. Check: Is the Authorization header listed in allowedHeaders?
4. Check: Does setAllowedOrigins include the React URL (with port!)?
5. Check: If using credentials, you CANNOT use "*" as allowed origin
6. Check: Is the preflight cached? (setMaxAge to avoid repeated OPTIONS calls)
```

---

**Q38. A pentester reports that your API returns different error messages for "user not found" vs "incorrect password." Why is this dangerous?**
*Architect's Answer:* This is a User Enumeration vulnerability. An attacker can determine which emails are registered by testing login attempts. Return the SAME generic message for both cases: "Invalid credentials." Spring Security's `DaoAuthenticationProvider` actually helps here — it runs `PasswordEncoder.matches()` even when the user is not found (to equalize response time).

---

**Q39. Your JWT-protected API works perfectly locally but fails in production behind an AWS ALB. Why?**
*Architect's Debugging Process:*
```
1. Check: Does the ALB strip the Authorization header? (Some ALB configs do this)
2. Check: Is the ALB performing TLS termination? If so, the backend receives HTTP.
   Spring's HSTS header says "use HTTPS" but the backend sees HTTP -> confusion
3. Fix: Trust the X-Forwarded-Proto header:
   server.forward-headers-strategy=NATIVE
4. Check: Is the ALB adding a health check that hits a secured endpoint? -> 401
   Fix: Expose /actuator/health as permitAll()
```

---

**Q40. Design a security system that supports both API Key authentication for external integrations AND JWT authentication for mobile apps in the same Spring Boot application.**
*Architect's Answer:*
```java
// Two separate SecurityFilterChain beans!

@Bean @Order(1)
public SecurityFilterChain apiKeyChain(HttpSecurity http) throws Exception {
    return http
        .securityMatcher("/api/external/**")
        .addFilterBefore(apiKeyFilter, UsernamePasswordAuthenticationFilter.class)
        .authorizeHttpRequests(auth -> auth.anyRequest().hasRole("API_CLIENT"))
        .build();
}

@Bean @Order(2)
public SecurityFilterChain jwtChain(HttpSecurity http) throws Exception {
    return http
        .securityMatcher("/api/**")
        .addFilterBefore(jwtFilter, UsernamePasswordAuthenticationFilter.class)
        .authorizeHttpRequests(auth -> auth
            .requestMatchers("/api/auth/**").permitAll()
            .anyRequest().authenticated())
        .build();
}
// Order matters! /api/external/** is matched first by Chain 1.
// All other /api/** URLs are matched by Chain 2.
```

---

# Part 17: Hands-on Practice Exercises

## Exercise 1: Build JWT Authentication System (Symmetric)

### Goal
Build a complete login system with Spring Boot + JWT from scratch.

### Step-by-Step
1. Generate User entity and Repository.
2. Implement CustomUserDetailsService.
3. Build `JwtService` utilizing `jjwt-api` with a hardcoded Secret Key (`HS256`).
4. Build `JwtAuthenticationFilter` that extends `OncePerRequestFilter`.
5. Return tokens inside `AuthController`.

### Detailed Implementation Checklist
```
[ ] Create Spring Boot project with: spring-boot-starter-security, web, jpa, postgresql
[ ] Create UserEntity with: id, email, passwordHash, role, active, locked
[ ] Create UserRepository with: findByEmail(String email)
[ ] Create CustomUserDetails (wrapper around UserEntity)
[ ] Create CustomUserDetailsService (implements UserDetailsService)
[ ] Create JwtService with:
    [ ] generateAccessToken(UserDetails user) -> returns JWT string
    [ ] extractUsername(String token) -> returns email from sub claim
    [ ] isTokenValid(String token, UserDetails user) -> boolean
    [ ] getSigningKey() -> SecretKey from Base64 secret
[ ] Create JwtAuthenticationFilter (extends OncePerRequestFilter)
    [ ] Extract Bearer token from Authorization header
    [ ] Validate token and set SecurityContext
    [ ] Add shouldNotFilter() for public endpoints
[ ] Create SecurityConfig:
    [ ] SessionCreationPolicy.STATELESS
    [ ] CSRF disabled
    [ ] addFilterBefore(jwtFilter, UsernamePasswordAuthenticationFilter.class)
    [ ] Custom AuthenticationEntryPoint returning JSON 401
[ ] Create AuthController:
    [ ] POST /api/auth/register -> hash password, save user
    [ ] POST /api/auth/login -> authenticate, return JWT
[ ] Create a protected endpoint: GET /api/users/me -> returns current user info
[ ] Test with Postman/cURL

Expected Test Flow:
  POST /api/auth/register -> 201 Created
  POST /api/auth/login -> 200 OK { "accessToken": "eyJ..." }
  GET /api/users/me (no token) -> 401 Unauthorized
  GET /api/users/me (with Bearer token) -> 200 OK { "email": "..." }
```

---

## Exercise 2: OAuth2 Resource Server (Asymmetric / JWKS)

### Goal
Set up a real Keycloak server and configure Spring Boot to validate JWTs via JWKS.

### Step-by-Step
1. Run a local instance of Keycloak via Docker.
2. Create a Realm and a Test User.
3. Configure `application.yml` to point `jwk-set-uri` at the Keycloak Endpoint.
4. Protect a REST API using `@PreAuthorize("hasAuthority('SCOPE_email')")`.
5. Obtain a Token via Postman (Implicit Flow) and call the Spring Boot API.

### Detailed Implementation Checklist
```
[ ] Run Keycloak: docker run -p 8180:8080 -e KEYCLOAK_ADMIN=admin -e KEYCLOAK_ADMIN_PASSWORD=admin quay.io/keycloak/keycloak start-dev
[ ] Login to Keycloak admin console: http://localhost:8180
[ ] Create a realm: "my-app-realm"
[ ] Create a client: "spring-boot-api" (confidential, Authorization Code)
[ ] Create a test user: "testuser" with password
[ ] Assign roles to the user: "user", "admin"
[ ] Note the JWKS endpoint: http://localhost:8180/realms/my-app-realm/protocol/openid-connect/certs
[ ] Configure Spring Boot application.yml with jwk-set-uri
[ ] Create SecurityConfig with oauth2ResourceServer(jwt())
[ ] Create JwtAuthenticationConverter to map Keycloak roles
[ ] Create protected endpoint: GET /api/profile
[ ] Use Postman to get a token from Keycloak's token endpoint
[ ] Call GET /api/profile with the Bearer token
[ ] Verify role-based access: user without "admin" role gets 403 on admin endpoint
```

---

## Exercise 3: Role-Based Authorization & Session Management

### Goal
Build a monolithic MVC application with session-based security, RBAC, and CSRF.

### Step-by-Step
1. Build an MVC Form-Login application.
2. Configure `.maximumSessions(1)` to block concurrent logins.
3. Implement `CookieCsrfTokenRepository` to inject anti-forgery tokens.
4. Map `ROLE_ADMIN` and `ROLE_USER` to different URLs.
5. Create a Service method protected by `@PreAuthorize("hasRole('ADMIN')")`.

### Detailed Implementation Checklist
```
[ ] Create Spring Boot project with: spring-boot-starter-security, web, thymeleaf, jpa, h2
[ ] Create UserEntity with roles (ManyToMany relationship)
[ ] Create a custom login page (Thymeleaf template)
[ ] Configure SecurityFilterChain:
    [ ] Form login with custom login page
    [ ] Session management: maximumSessions(1), migrateSession()
    [ ] URL-based security: /admin/** requires ROLE_ADMIN
    [ ] CSRF enabled (default for form login)
[ ] Create AdminController: GET /admin/dashboard -> only ADMIN can access
[ ] Create UserController: GET /user/profile -> any authenticated user
[ ] Create AdminService with @PreAuthorize("hasRole('ADMIN')")
[ ] Test concurrent session control:
    [ ] Login as user1 in Chrome
    [ ] Login as user1 in Firefox (incognito)
    [ ] Verify: first session is expired/second login is blocked
[ ] Test CSRF: try a direct POST without _csrf token -> verify 403
[ ] Test Role-based access: user with ROLE_USER tries /admin -> verify 403
```

---

## Exercise 4: Microservices Security with API Gateway (Advanced)

### Goal
Build a microservices ecosystem with JWT-based auth passing through an API Gateway.

### Step-by-Step
```
[ ] Create 3 Spring Boot projects: api-gateway, auth-service, order-service
[ ] Auth Service:
    [ ] POST /auth/login -> validates credentials, returns JWT (HS256 for simplicity)
    [ ] Exposes JWKS endpoint (optional: hardcoded public key for simplicity)
[ ] API Gateway (Spring Cloud Gateway):
    [ ] Routes /api/auth/** -> auth-service
    [ ] Routes /api/orders/** -> order-service
    [ ] JwtGatewayFilter: validates JWT, forwards X-Forwarded-User header
[ ] Order Service:
    [ ] GET /api/orders -> returns orders for the user in X-Forwarded-User header
    [ ] No Spring Security dependency (trusts Gateway)
[ ] Test flow:
    [ ] POST /api/auth/login -> get JWT
    [ ] GET /api/orders (with JWT) -> Gateway validates -> Order Service returns data
    [ ] GET /api/orders (without JWT) -> Gateway returns 401
```

---

## Exercise 5: Security Testing & Penetration Testing Basics

### Goal
Test your secured application against common attack vectors.

### Checklist
```
[ ] Test SQL Injection: Try login with email: ' OR 1=1 --
    -> Verify: Spring Data JPA prevents it (parameterized queries)
[ ] Test CSRF: Create an external HTML page that auto-submits a POST
    -> Verify: Spring rejects it (missing _csrf token)
[ ] Test XSS: Try injecting <script>alert('xss')</script> in input fields
    -> Verify: Content-Security-Policy header blocks inline scripts
[ ] Test Session Fixation: Copy JSESSIONID before login, try using it after
    -> Verify: JSESSIONID changes after authentication
[ ] Test Brute Force: Send 50 login requests with wrong passwords
    -> Verify: Account lockout kicks in after 5 attempts
[ ] Test CORS: Make a fetch() call from a different origin
    -> Verify: Browser blocks it (unless origin is in allowedOrigins)
[ ] Test JWT Tampering: Decode JWT, change "role" to "ADMIN", re-encode
    -> Verify: Signature validation fails (401 Unauthorized)
[ ] Test Expired Token: Wait for access token to expire, try using it
    -> Verify: 401 returned, refresh token flow generates new access token
```
