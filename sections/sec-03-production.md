# Part 12: Microservices Security Architecture (Zero-Trust)

## 12.1 Architect's View: Zero-Trust Security

Historically, IT organizations used **Perimeter Security** (the "Castle and Moat" architecture). If a request originated from outside the VPN, it was untrusted. If a request originated from *inside* the VPN (e.g., between two internal microservices), it was implicitly trusted.

**Zero-Trust Architecture** dictates: "Never trust, always verify." Every single network request—even between two internal microservices strictly inside AWS VPC—must be authenticated, authorized, and encrypted.

### Deep Concept Explanation

**WHAT:** Zero-Trust is a security model where NO entity (user, service, device, network segment) is automatically trusted, regardless of its physical or network location. Every access request must be authenticated, authorized, and encrypted before being granted.

**WHY it exists:** The Perimeter Security model failed catastrophically in the era of cloud, microservices, and remote work. If an attacker breaches a single microservice inside a VPC (e.g., via a Log4j vulnerability), Perimeter Security gives them free, unrestricted access to EVERY other internal service — because internal traffic is "trusted." Zero-Trust prevents this lateral movement.

**WHEN to adopt Zero-Trust:**
- When running microservices on Kubernetes/ECS (services communicate over internal networks)
- When multiple teams own different services (a compromised team's service shouldn't affect others)
- When handling sensitive data (healthcare, financial, government)
- When regulatory compliance requires it (PCI-DSS, HIPAA, SOC2)

**WHERE it is used in real-world systems:**
- **Google's BeyondCorp:** Every Google employee's laptop is treated as if it's on the public internet. No VPN needed; every request is individually authenticated.
- **Netflix:** Every microservice-to-microservice call is authenticated using mTLS via their Zuul gateway.
- **Banks:** Internal trading APIs are protected with certificate-based authentication even between internal services.

### Two Patterns for Internal Security: API Gateway vs Service Mesh

| Pattern | API Gateway Security (Centralized) | Service Mesh Security (Decentralized) |
|---|---|---|
| **Mechanism** | The Gateway validates the JWT. It forwards raw User IDs to internal services via trusted HTTP headers (`X-User-Id`). | The Gateway forwards the JWT. Every single Microservice uses Spring Security to independently cryptographically verify the Token. |
| **Trust Model** | The internal services implicitly trust the Gateway. (Violation of strict Zero-Trust). | Strict Zero-Trust. Service B doesn't care who sent the request, it verifies the JWT itself. |
| **mTLS** | Optional / Handled by API Gateway. | Mandatory. Proxies (Envoy/Istio) encrypt traffic between `Service A <-> Service B`. |
| **Implementation** | Easy. Only the Gateway holds Spring Security logic. Downstream services just read the Headers. | Hard. Every service needs Spring Security `oauth2ResourceServer(jwt())` configured. |
| **Performance** | Fast. JWT parsed once at the Gateway. | Slower. JWT parsed at every hop. Each service fetches/caches JWKS keys. |
| **Security Level** | Medium. If Gateway is bypassed, internal services are exposed. | High. Even if an internal service is directly accessed, it rejects unauthenticated requests. |

### Real-World Production Scenario: Choosing an Architecture

```
Scenario: E-commerce platform with 12 microservices

Services: Auth Service, User Service, Product Service, Order Service,
          Payment Service, Notification Service, Search Service, etc.

Team discussion:

CTO: "We need to secure internal communication."

Option 1 — API Gateway Pattern (chosen for v1.0):
  Pros: 
    - Quick to implement; only Gateway has Spring Security
    - Lower latency (JWT parsed once)
  Cons:
    - If someone bypasses Gateway (e.g. direct Kubernetes port-forward), 
      services are unprotected
  Decision: Acceptable for MVP, plan migration to Zero-Trust later

Option 2 — Zero-Trust Pattern (target for v2.0):
  Pros:
    - Every service independently validates JWT
    - Even Kubernetes pod compromise doesn't spread
  Cons:
    - Every service needs oauth2ResourceServer configured
    - JWKS caching must be tuned for performance
  Decision: Migrate after product-market fit is established
```

---

## 12.2 How It Works (Strict Zero-Trust Pattern)

```
Step 1: Client logs in via External Auth Server (e.g., Keycloak)
        POST /realms/myapp/protocol/openid-connect/token
        Returns JWT: { accessToken, refreshToken }

Step 2: Client sends API request with JWT
        GET /api/orders
        Authorization: Bearer eyJhbGci...

Step 3: Spring Cloud Gateway intercepts
        - Extracts JWT from header
        - Validates signature against JWKS (Does NOT call Auth Server)
        - If valid: forwards request with original Authorization header attached.

Step 4: Downstream Microservice (Order Service) receives request
        - Spring Security intercepts the incoming request.
        - Fetches JWKS Public Keys from cache.
        - Cryptographically verifies the JWT payload again!
        - Verifies the Token Scope (e.g. `hasAuthority('SCOPE_read:orders')`)
```

### Step-by-Step: Configuring Zero-Trust in Each Microservice

Every microservice in a Zero-Trust architecture needs this configuration:

```yaml
# application.yml for Order Service
spring:
  security:
    oauth2:
      resourceserver:
        jwt:
          issuer-uri: https://keycloak.internal.company.com/realms/production
          jwk-set-uri: https://keycloak.internal.company.com/realms/production/protocol/openid-connect/certs
```

```java
// SecurityConfig.java for Order Service
@Configuration
@EnableWebSecurity
@EnableMethodSecurity
public class OrderServiceSecurityConfig {

    @Bean
    public SecurityFilterChain filterChain(HttpSecurity http) throws Exception {
        return http
            .csrf(csrf -> csrf.disable())
            .sessionManagement(s -> s.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
            .authorizeHttpRequests(auth -> auth
                .requestMatchers("/actuator/health").permitAll()
                .anyRequest().authenticated()
            )
            .oauth2ResourceServer(oauth2 -> oauth2
                .jwt(jwt -> jwt.jwtAuthenticationConverter(keycloakRoleConverter()))
            )
            .build();
    }

    // Map Keycloak's realm_access.roles to Spring Security authorities
    @Bean
    public JwtAuthenticationConverter keycloakRoleConverter() {
        JwtAuthenticationConverter converter = new JwtAuthenticationConverter();
        converter.setJwtGrantedAuthoritiesConverter(jwt -> {
            Map<String, Object> realmAccess = jwt.getClaimAsMap("realm_access");
            if (realmAccess == null) return Collections.emptyList();
            List<String> roles = (List<String>) realmAccess.get("roles");
            return roles.stream()
                .map(role -> new SimpleGrantedAuthority("ROLE_" + role))
                .collect(Collectors.toList());
        });
        return converter;
    }
}
```

---

## 12.3 API Gateway JWT Filter (Centralized Trust Pattern)

If deciding to NOT use strict Zero-Trust for performance reasons, the Gateway parses the JWT and forwards the data as downstream trusted HTTP Headers.

```java
@Component
public class JwtGatewayFilter implements GatewayFilter {

    @Autowired private JwtService jwtService;

    @Override
    public Mono<Void> filter(ServerWebExchange exchange, GatewayFilterChain chain) {
        String authHeader = exchange.getRequest()
            .getHeaders().getFirst("Authorization");

        if (authHeader == null || !authHeader.startsWith("Bearer ")) {
            exchange.getResponse().setStatusCode(HttpStatus.UNAUTHORIZED);
            return exchange.getResponse().setComplete();
        }

        String token = authHeader.substring(7);
        try {
            String userId = jwtService.extractSubject(token);
            List<String> roles = jwtService.extractRoles(token);

            // Forward user info to downstream Spring Boot apps via raw Headers
            ServerHttpRequest modifiedRequest = exchange.getRequest()
                .mutate()
                .header("X-Forwarded-User", userId)
                .header("X-Forwarded-Roles", String.join(",", roles))
                .build();

            return chain.filter(
                exchange.mutate().request(modifiedRequest).build());
        } catch (JwtException e) {
            exchange.getResponse().setStatusCode(HttpStatus.UNAUTHORIZED);
            return exchange.getResponse().setComplete();
        }
    }
}
```

### Internal Working: How Downstream Services Read Gateway Headers

When using the Centralized Trust Pattern, downstream services don't need Spring Security at all. They simply read the trusted headers:

```java
// In downstream Order Service (no Spring Security dependency needed!)
@RestController
@RequestMapping("/api/orders")
public class OrderController {

    @GetMapping
    public List<Order> getMyOrders(
            @RequestHeader("X-Forwarded-User") String userId,
            @RequestHeader("X-Forwarded-Roles") String roles) {
        
        // Trust the Gateway's headers implicitly
        if (!roles.contains("ROLE_USER")) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN);
        }
        return orderService.findByUserId(Long.parseLong(userId));
    }
}
```

### Security Pitfall: Header Spoofing Attack

```
CRITICAL VULNERABILITY in the Centralized Trust Pattern:

If an attacker bypasses the API Gateway (e.g., via Kubernetes port-forward 
or a misconfigured network policy), they can directly call the Order Service 
with FORGED headers:

  curl http://order-service:8080/api/orders \
    -H "X-Forwarded-User: admin-user-id" \
    -H "X-Forwarded-Roles: ROLE_ADMIN"
    
The Order Service blindly trusts these headers = FULL ADMIN ACCESS!

MITIGATION:
1. Kubernetes NetworkPolicies: Only allow traffic FROM the Gateway pod
2. mTLS: Verify client certificates on downstream services
3. Add a shared secret header that only the Gateway knows
4. Or: Switch to Zero-Trust (each service validates JWT independently)
```

---

## 12.4 Inter-Service Authentication (mTLS / Service Accounts)

If `Order Service` needs to talk to `Payment Service` *without* a user Context (e.g., a background batch job), how does `Order Service` authenticate?

**Option 1: OAuth2 Client Credentials Flow**
The `Order Service` has its own `client_id` and `client_secret`. It calls the Auth Server to request an access token with machine-level scopes (e.g. `process:payments`). It attaches this token to its FeignClient calls.

**Option 2: Mutual TLS (mTLS)**
Handled infra-level by Istio or AWS App Mesh. Both Microservices present an X.509 Certificate. The Transport Layer verifies the identity before a single byte of HTTP data is sent. Spring Boot is completely unaware of the security!

### Deep Concept Explanation: OAuth2 Client Credentials Flow

```
Scenario: Order Service needs to call Payment Service to process a refund.
          There is no logged-in user — this is a scheduled batch job at 2 AM.

Step 1: Order Service calls Keycloak with its OWN credentials
        POST /realms/production/protocol/openid-connect/token
        grant_type=client_credentials
        client_id=order-service
        client_secret=<order-service-secret>
        scope=payment:process payment:refund

Step 2: Keycloak returns a machine-level JWT
        {
          "sub": "order-service",
          "scope": "payment:process payment:refund",
          "iss": "https://keycloak.company.com/realms/production",
          "exp": 1710230400
        }

Step 3: Order Service calls Payment Service with this JWT
        POST http://payment-service/api/payments/refund
        Authorization: Bearer <machine-jwt>
        Body: { orderId: 42, amount: 99.99 }

Step 4: Payment Service validates the JWT using JWKS
        Checks: hasAuthority("SCOPE_payment:refund")? YES -> Process refund
```

### Step-by-Step: Implementing Client Credentials in Spring Boot

```java
// In Order Service: Configure WebClient with OAuth2 Client Credentials
@Configuration
public class OAuth2ClientConfig {

    @Bean
    public WebClient paymentServiceClient(
            ReactiveClientRegistrationRepository clientRegRepo,
            ServerOAuth2AuthorizedClientRepository authClientRepo) {
        
        ServerOAuth2AuthorizedClientExchangeFilterFunction oauth2Filter =
            new ServerOAuth2AuthorizedClientExchangeFilterFunction(
                clientRegRepo, authClientRepo);
        
        oauth2Filter.setDefaultClientRegistrationId("payment-service-client");
        
        return WebClient.builder()
            .baseUrl("http://payment-service:8080")
            .filter(oauth2Filter)  // Automatically attaches Bearer token!
            .build();
    }
}

// application.yml
spring:
  security:
    oauth2:
      client:
        registration:
          payment-service-client:
            provider: keycloak
            client-id: order-service
            client-secret: ${ORDER_SERVICE_CLIENT_SECRET}
            authorization-grant-type: client_credentials
            scope: payment:process,payment:refund
        provider:
          keycloak:
            token-uri: https://keycloak.company.com/realms/production/protocol/openid-connect/token
```

---

# Part 13: Security Best Practices & Defense

## 13.1 Cross-Origin Resource Sharing (CORS) Architecture

**Why CORS exists:** Browsers prevent malicious website `evil.com` from making an AJAX request to your bank `secure-bank.com` and reading the response.

### Deep Concept Explanation

**WHAT:** CORS (Cross-Origin Resource Sharing) is a browser security mechanism that restricts HTTP requests made from JavaScript running on Domain A to an API on Domain B. The browser enforces this by checking response headers from Domain B before allowing the JavaScript to read the response.

**WHY it exists:** Without CORS, any website could make AJAX requests to any other website. If you're logged into your bank at `bank.com` and visit `evil.com`, evil.com's JavaScript could call `bank.com/api/transfer` — and the browser would attach your bank's cookies! CORS prevents `evil.com` from reading the response, but the request might still be sent (hence CSRF protection is also needed).

**WHEN CORS becomes relevant:**
- React SPA on `http://localhost:3000` calling Spring Boot on `http://localhost:8080` (different ports = different origins)
- Production frontend on `https://app.company.com` calling API on `https://api.company.com` (different subdomains = different origins)
- Mobile apps DO NOT enforce CORS (CORS is browser-only)

**WHERE CORS is NOT relevant:**
- Server-to-server calls (FeignClient, RestTemplate, WebClient) — CORS is browser-only
- Mobile app API calls — native HTTP clients don't enforce CORS
- Same-origin deployments — when frontend and backend share the same domain and port

---

### The Architect's View: The Preflight OPTIONS Request

When an SPA (React/Angular) running on `http://localhost:3000` tries to call `https://api.myapp.com`, the browser automatically stops the `POST` request. 

Instead, the browser silently sends an `OPTIONS` HTTP request demanding the server answer: *"Are you willing to accept a POST request from localhost:3000?"*

**If your Spring Security Filter Chain blocks the `OPTIONS` request with a 401 Unauthorized, CORS will fail! The Preflight request DOES NOT contain an Authorization header.**

### Internal Working: What the Browser Actually Does

```
1. JavaScript makes: fetch('https://api.myapp.com/orders', { method: 'POST' })
2. Browser detects: Cross-Origin request (different origin)
3. Browser checks: Is this a "Simple Request"?
   - Simple Request = GET/HEAD/POST with standard headers only
   - If simple: Browser sends the request directly with Origin header
   - If NOT simple (has Authorization header, PUT/DELETE, custom headers):

4. Browser sends PREFLIGHT request:
   OPTIONS /orders HTTP/1.1
   Host: api.myapp.com
   Origin: http://localhost:3000
   Access-Control-Request-Method: POST
   Access-Control-Request-Headers: Authorization, Content-Type

5. Server responds:
   200 OK
   Access-Control-Allow-Origin: http://localhost:3000
   Access-Control-Allow-Methods: GET, POST, PUT, DELETE
   Access-Control-Allow-Headers: Authorization, Content-Type
   Access-Control-Max-Age: 3600   ← Cache this preflight for 1 hour

6. Browser sees: Preflight passed! Now sends the ACTUAL request:
   POST /orders HTTP/1.1
   Host: api.myapp.com
   Origin: http://localhost:3000
   Authorization: Bearer eyJhbG...
   Content-Type: application/json
```

### Proper Spring Setup: `CorsFilter` Before Security

```java
@Bean
public CorsConfigurationSource corsConfigurationSource() {
    CorsConfiguration config = new CorsConfiguration();
    // NEVER use "*" in production if you allow credentials
    config.setAllowedOrigins(List.of("https://myapp.com", "http://localhost:3000"));
    config.setAllowedMethods(List.of("GET", "POST", "PUT", "DELETE", "OPTIONS"));
    config.setAllowedHeaders(List.of("Authorization", "Content-Type", "X-Requested-With"));
    
    // Required if the frontend sends Cookies or Basic Auth credentials
    config.setAllowCredentials(true); 
    
    // Cache the preflight response for 1 hour so the browser doesn't send infinite OPTIONS requests
    config.setMaxAge(3600L);

    UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
    source.registerCorsConfiguration("/api/**", config);
    return source;
}

// In SecurityFilterChain:
http.cors(cors -> cors.configurationSource(corsConfigurationSource()));
```

### Security Pitfalls: CORS Mistakes

| Mistake | Risk | Fix |
|---|---|---|
| `setAllowedOrigins(List.of("*"))` with `setAllowCredentials(true)` | Browser blocks the request (invalid config). You cannot use wildcard with credentials. | List specific origins explicitly |
| Not including `"OPTIONS"` in allowed methods | Preflight requests fail with 403 | Always include OPTIONS |
| Setting CORS at `@CrossOrigin` on each Controller | Inconsistent, easy to forget on new endpoints | Centralize CORS in `SecurityConfig` using `CorsConfigurationSource` |
| Not setting `Access-Control-Max-Age` | Browser sends a preflight for EVERY single API call | Set `maxAge(3600)` — cache for 1 hour |

### Monolithic vs Microservices: CORS Configuration

```
MONOLITHIC:
  Configure CORS once in the single SecurityConfig.
  Frontend URL is known and static.
  
MICROSERVICES:
  Option A: Configure CORS ONLY at the API Gateway level.
            Individual microservices don't need CORS because browsers 
            only talk to the Gateway.
  
  Option B: Each microservice configures CORS independently.
            Necessary if services are exposed directly (no Gateway).
            
  Recommended: Option A — centralize CORS at the Gateway.
```

---

## 13.2 Cross-Site Request Forgery (CSRF) Prevention

**Cause:** An attacker tricks a user's browser into executing a state-changing request (POST/DELETE) against a session-authenticated app where the user is already logged in. The browser blindly attaches the JSESSIONID cookie.

| Architecture Type | CSRF Risk | Solution |
|---|---|---|
| **Form-Login MVC** | High Risk. Browsers auto-attach Cookies. | Must Enable CSRF. Spring inserts an anti-forgery hidden `_csrf` token in HTML forms. |
| **REST API (Cookie Auth)** | High Risk. SPAs using HttpOnly Session cookies. | Use `CookieCsrfTokenRepository` to inject the CSRF token into a Javascript-readable cookie. |
| **REST API (JWT Auth)** | Zero Risk. Browsers do NOT auto-attach Authorization Headers. | Safe to completely `.disable()` CSRF in Spring Security. |

### Deep Concept Explanation: How CSRF Works Internally

```
The Attack:

1. User logs into bank.com (gets JSESSIONID cookie for bank.com)
2. User visits evil.com (still has bank.com cookie in browser)
3. evil.com has hidden HTML:
   <form action="https://bank.com/transfer" method="POST">
     <input type="hidden" name="to" value="attacker-account">
     <input type="hidden" name="amount" value="10000">
   </form>
   <script>document.forms[0].submit();</script>
4. Browser submits POST to bank.com WITH the JSESSIONID cookie (auto-attached!)
5. Bank server sees valid session cookie -> processes the transfer!
6. $10,000 gone to attacker's account!

Spring Security's Defense:

1. Spring generates a random token: csrf_token = "abc123xyz"
2. Spring embeds it in the HTML form: <input type="hidden" name="_csrf" value="abc123xyz">
3. When the form is submitted, Spring checks: does _csrf match the session's token?
4. evil.com CANNOT read this token (Same-Origin Policy prevents it)
5. evil.com's forged form doesn't include _csrf -> Spring REJECTS the request
```

### Real-World Production Scenario: CSRF in SPA + Cookie Architecture

```
Scenario: React SPA uses HttpOnly cookies for authentication (not JWT headers).
          The JSESSIONID cookie is auto-attached by the browser.
          CSRF protection is NEEDED!

Spring Boot Configuration:
  .csrf(csrf -> csrf
      .csrfTokenRepository(CookieCsrfTokenRepository.withHttpOnlyFalse())
      // Sets a non-HttpOnly XSRF-TOKEN cookie that JavaScript CAN read
  )

React Frontend:
  // Read the XSRF-TOKEN cookie set by Spring
  const csrfToken = document.cookie
    .split('; ')
    .find(row => row.startsWith('XSRF-TOKEN='))
    ?.split('=')[1];
  
  // Include it in the X-XSRF-TOKEN header for POST/PUT/DELETE requests
  fetch('/api/orders', {
    method: 'POST',
    headers: { 'X-XSRF-TOKEN': csrfToken },
    body: JSON.stringify(order)
  });
```

---

## 13.3 Security Headers

By default, Spring Security automatically injects a robust set of security headers into every HTTP Response.

```
HTTP/1.1 200 OK
Cache-Control: no-cache, no-store, max-age=0, must-revalidate
Pragma: no-cache
Expires: 0
X-Content-Type-Options: nosniff
Strict-Transport-Security: max-age=31536000 ; includeSubDomains
X-Frame-Options: DENY
X-XSS-Protection: 1; mode=block
```

What do they do?
1. **Strict-Transport-Security (HSTS):** Browsers caching that this domain MUST be contacted via HTTPS, thwarting downgrade/SSL-stripping attacks.
2. **X-Frame-Options: DENY:** Prevents "Clickjacking" (an attacker embedding your site in a hidden `<iframe>` to trick users into clicking buttons).
3. **X-Content-Type-Options: nosniff:** Prevents browsers from guessing the MIME type, thwarting script execution disguised as image files.

### Deep Dive: Content Security Policy (CSP)

Spring Security does NOT add a Content-Security-Policy (CSP) header by default because it varies wildly per application. But in production, you SHOULD add one:

```java
@Bean
public SecurityFilterChain filterChain(HttpSecurity http) throws Exception {
    return http
        .headers(headers -> headers
            .contentSecurityPolicy(csp -> csp
                .policyDirectives(
                    "default-src 'self'; " +
                    "script-src 'self' https://cdn.jsdelivr.net; " +
                    "style-src 'self' https://fonts.googleapis.com; " +
                    "img-src 'self' data: https://images.myapp.com; " +
                    "connect-src 'self' https://api.myapp.com; " +
                    "font-src 'self' https://fonts.gstatic.com; " +
                    "frame-src 'none'"
                ))
        )
        .build();
}
```

This CSP header tells the browser:
- Only load scripts from `self` and `cdn.jsdelivr.net`
- Only load images from `self`, `data:` URIs, and `images.myapp.com`
- Disallow all `<iframe>` embedding (`frame-src 'none'`)
- If an attacker injects `<script src="evil.com/malware.js">`, the browser BLOCKS it!

---

# Part 14: Production Security Challenges

## 14.1 Token Leaks & JWT Revocation Logic

**The Problem:** JWTs are stateless. If an access token with a 24-hour lifespan is stolen by a hacker, there is no "session" to delete on the server. The token is valid cryptographically!

**The Architect's Mitigations:**
1. **Short-Lived Access Tokens:** Keep them at 10-15 minutes max. Use Refresh Tokens to handle silent renewals.
2. **Redis Blacklisting:**
   Upon user logout, add the `jti` (JWT ID claim) to a distributed Redis cache with a Time-To-Live (TTL) matching the token's remaining time.
   Inside your `JwtFilter`, add one `redisTemplate.hasKey("blacklist:" + jti)` lookup.

```java
// If true, the user clicked "Logout" before the token's natural expiration.
if (redisTemplate.hasKey("blacklist:" + claims.getId())) {
    throw new JwtException("Token has been revoked/blacklisted.");
}
```

### Deep Concept Explanation: Token Revocation at Scale

**The Challenge:** In a microservices ecosystem handling 50,000 requests/second, checking Redis on EVERY request adds latency and load.

**Architect's Approach: Layered Revocation Strategy**

```
Layer 1: Access Token Expiration (10-15 minutes)
  - Most revocations are handled naturally by short TTLs
  - If a token is stolen, damage window is only 15 minutes
  - No Redis check needed for most requests!

Layer 2: Refresh Token Blacklisting (upon explicit logout)
  - When user logs out: blacklist the refresh token in Redis
  - The access token will expire naturally in < 15 minutes
  - Refresh attempts will fail -> user is effectively logged out

Layer 3: Emergency Token Revocation (security incident)
  - Mass revocation: rotate the JWT signing key
  - ALL existing tokens become invalid immediately
  - Users must re-authenticate (acceptable during a breach)
  
Layer 4: Bloom Filter for High-Throughput Blacklists
  - Instead of Redis lookup per request, use a Bloom Filter
  - Probabilistic data structure: "definitely NOT blacklisted" (fast)
    or "MIGHT be blacklisted" (check Redis to confirm)
  - Reduces Redis calls by ~99% for non-revoked tokens
```

### Real-World Production Scenario: Handling a Token Leak Incident

```
Scenario: DevOps discovers that access tokens are being logged in plain text
          by the API Gateway's access logger (a misconfigured logging pipeline).
          Potentially thousands of tokens are exposed in log files.

Incident Response:
  1. IMMEDIATE: Rotate the JWT signing key on the Auth Server
     - All existing access tokens fail cryptographic validation
     - All users are forced to re-login (access disruption = 2 minutes)
     
  2. IMMEDIATE: Purge the exposed log files and fix the logging config
  
  3. POST-INCIDENT: Implement token fingerprinting
     - Bind each token to the client's IP + User-Agent hash
     - If someone replays the token from a different IP -> reject
     
  4. POST-INCIDENT: Set Access Token TTL to 5 minutes (from 15)
     - Shorter damage window for future incidents
```

---

## 14.2 Session Fixation Defense

**Cause:** An attacker visits your site, gets an anonymous `JSESSIONID=123`. The attacker sends a link to the victim: `http://myapp.com/login?JSESSIONID=123`. The victim clicks it and logs in. The server considers `123` authenticated. The attacker now refreshes their own tabs and assumes the victim's identity!

**Spring's Defense:** Spring Security natively runs `sessionFixation().migrateSession()`. The moment authentication succeeds, Spring generates an entirely new random `JSESSIONID` and invalidates the old one.

### Internal Working: Session Fixation Strategies

```java
.sessionManagement(session -> session
    // Option 1: migrateSession (DEFAULT & RECOMMENDED)
    // Creates a new session and copies all attributes from the old one
    .sessionFixation().migrateSession()
    
    // Option 2: newSession
    // Creates a brand new session, does NOT copy attributes
    // Use when old session might contain attacker-injected data
    .sessionFixation().newSession()
    
    // Option 3: changeSessionId (Servlet 3.1+)
    // Keeps the same session but changes the ID
    // Fastest option, but session object is reused
    .sessionFixation().changeSessionId()
    
    // Option 4: none (NEVER use in production!)
    // Disables session fixation protection entirely
    .sessionFixation().none()
)
```

---

## 14.3 Account Lockout and Dictionary Attacks

An attacker launches a script testing millions of common passwords against an administrator's email.

**Mitigation Layering:**
1. **Rate Limiting:** Throttle API requests via API Gateway (`Limit 10 POST /login per IP per min`).
2. **Account Lockout:** Track failed attempts in the database. `failed_attempts += 1`. After 5 failures, set `locked_until = now() + 30 mins`. Spring's `isAccountNonLocked()` checks this.
3. **CAPTCHA/MFA Integration:** If `failed_attempts > 3`, force the frontend to display a Google reCAPTCHA.

### Step-by-Step: Complete Account Lockout Implementation

```java
// Step 1: Add lockout fields to the User entity
@Entity
public class UserEntity {
    @Id @GeneratedValue
    private Long id;
    private String email;
    private String passwordHash;
    
    private int failedAttempts = 0;
    private LocalDateTime lockedUntil;
    
    public boolean isAccountLocked() {
        return lockedUntil != null && LocalDateTime.now().isBefore(lockedUntil);
    }
}

// Step 2: Create a service to track login attempts
@Service
@RequiredArgsConstructor
public class LoginAttemptService {
    
    private final UserRepository userRepository;
    private static final int MAX_ATTEMPTS = 5;
    private static final int LOCK_DURATION_MINUTES = 30;
    
    @Transactional
    public void loginFailed(String email) {
        userRepository.findByEmail(email).ifPresent(user -> {
            int attempts = user.getFailedAttempts() + 1;
            user.setFailedAttempts(attempts);
            
            if (attempts >= MAX_ATTEMPTS) {
                user.setLockedUntil(LocalDateTime.now().plusMinutes(LOCK_DURATION_MINUTES));
            }
            userRepository.save(user);
        });
    }
    
    @Transactional
    public void loginSucceeded(String email) {
        userRepository.findByEmail(email).ifPresent(user -> {
            user.setFailedAttempts(0);
            user.setLockedUntil(null);
            userRepository.save(user);
        });
    }
}

// Step 3: Hook into Spring Security's authentication events
@Component
@RequiredArgsConstructor
public class AuthenticationEventListener {
    
    private final LoginAttemptService loginAttemptService;
    
    @EventListener
    public void onAuthenticationFailure(AuthenticationFailureBadCredentialsEvent event) {
        String email = (String) event.getAuthentication().getPrincipal();
        loginAttemptService.loginFailed(email);
    }
    
    @EventListener
    public void onAuthenticationSuccess(AuthenticationSuccessEvent event) {
        String email = event.getAuthentication().getName();
        loginAttemptService.loginSucceeded(email);
    }
}

// Step 4: Check lock status in CustomUserDetailsService
@Override
public UserDetails loadUserByUsername(String email) {
    UserEntity user = userRepository.findByEmail(email)
        .orElseThrow(() -> new UsernameNotFoundException("Not found"));
    
    if (user.isAccountLocked()) {
        throw new LockedException("Account is locked until " + user.getLockedUntil());
    }
    
    return new CustomUserDetails(user);
}
```

### Monolithic vs Microservices: Account Lockout

| Aspect | Monolithic | Microservices |
|---|---|---|
| **Storage** | Same DB as user table | Auth Service's dedicated DB (only Auth Service manages lockouts) |
| **Rate Limiting** | Implement in Spring Security filter | Implement at API Gateway level (e.g., Spring Cloud Gateway `RequestRateLimiter` with Redis) |
| **Distributed tracking** | Single server, simple in-memory counter | Use Redis-based counter shared across all instances of Auth Service |
| **Notification** | Email service is in same process | Publish `AccountLockedEvent` to Kafka -> Notification Service sends email |

---

# Part 15: Complete Spring Boot Security Project Skeleton

## 15.1 Project Structure

```text
secure-enterprise-app/
├── src/main/java/com/secureapp/
│   ├── SecureAppApplication.java
│   ├── config/
│   │   ├── CorsConfig.java               # Centralized CORS
│   │   ├── MethodSecurityConfig.java     # Enables @PreAuthorize
│   │   └── OpenApiConfig.java            # Swagger annotations
│   ├── controller/
│   │   └── AuthController.java           # Returns JWT payloads
│   ├── entity/
│   │   └── UserEntity.java               # JPA Entity
│   ├── security/
│   │   ├── SecurityConfig.java           # FilterChain definition
│   │   ├── JwtService.java               # Token generation/verification via Nimbus
│   │   ├── JwtAuthenticationFilter.java  # The interceptor proxy
│   │   ├── CustomUserDetails.java        # Wrapper for UserEntity
│   │   └── CustomUserDetailsService.java # DB Lookup logic
│   └── exception/
│       └── SecurityExceptionHandler.java # Customizes 401/403 responses
└── src/main/resources/
    └── application.yml
```

### Architect's View: Microservices Security Project Structure

```text
enterprise-microservices/
├── api-gateway/
│   ├── src/main/java/com/gateway/
│   │   ├── GatewayApplication.java
│   │   ├── config/
│   │   │   ├── GatewaySecurityConfig.java    # JWKS validation
│   │   │   ├── CorsConfig.java               # Centralized CORS
│   │   │   └── RateLimitConfig.java          # Redis-based rate limiting
│   │   └── filter/
│   │       └── JwtGatewayFilter.java         # Extracts user info from JWT
│   └── src/main/resources/
│       └── application.yml                    # Route definitions
│
├── auth-service/
│   ├── src/main/java/com/auth/
│   │   ├── AuthServiceApplication.java
│   │   ├── controller/
│   │   │   └── AuthController.java            # /login, /register, /refresh
│   │   ├── security/
│   │   │   ├── SecurityConfig.java
│   │   │   ├── JwtService.java                # Signs tokens with PRIVATE key
│   │   │   └── CustomUserDetailsService.java
│   │   └── entity/
│   │       └── UserEntity.java
│   └── src/main/resources/
│       ├── application.yml
│       └── keys/
│           ├── private-key.pem               # RS256 private key (GUARDED!)
│           └── public-key.pem                # Published via JWKS endpoint
│
├── order-service/
│   ├── src/main/java/com/orders/
│   │   ├── OrderServiceApplication.java
│   │   ├── config/
│   │   │   └── SecurityConfig.java           # oauth2ResourceServer(jwt())
│   │   └── controller/
│   │       └── OrderController.java
│   └── src/main/resources/
│       └── application.yml                   # jwk-set-uri pointing to auth-service
│
└── docker-compose.yml                        # Orchestrates all services
```

---

## 15.2 Spring Boot Starter Dependencies

```xml
<dependencies>
    <!-- Core Spring Security -->
    <dependency>
        <groupId>org.springframework.boot</groupId>
        <artifactId>spring-boot-starter-security</artifactId>
    </dependency>
    <!-- OAuth2 Resource Server for JWT Parsing -->
    <dependency>
        <groupId>org.springframework.boot</groupId>
        <artifactId>spring-boot-starter-oauth2-resource-server</artifactId>
    </dependency>
    <!-- Web for REST APIs -->
    <dependency>
        <groupId>org.springframework.boot</groupId>
        <artifactId>spring-boot-starter-web</artifactId>
    </dependency>
</dependencies>
```

### Full Dependencies for Production-Grade Security Setup

```xml
<dependencies>
    <!-- Core -->
    <dependency>
        <groupId>org.springframework.boot</groupId>
        <artifactId>spring-boot-starter-security</artifactId>
    </dependency>
    <dependency>
        <groupId>org.springframework.boot</groupId>
        <artifactId>spring-boot-starter-web</artifactId>
    </dependency>
    
    <!-- JWT (Choose ONE: jjwt OR spring-oauth2-resource-server) -->
    <!-- Option A: Manual JWT with jjwt -->
    <dependency>
        <groupId>io.jsonwebtoken</groupId>
        <artifactId>jjwt-api</artifactId>
        <version>0.12.5</version>
    </dependency>
    <dependency>
        <groupId>io.jsonwebtoken</groupId>
        <artifactId>jjwt-impl</artifactId>
        <version>0.12.5</version>
        <scope>runtime</scope>
    </dependency>
    <dependency>
        <groupId>io.jsonwebtoken</groupId>
        <artifactId>jjwt-jackson</artifactId>
        <version>0.12.5</version>
        <scope>runtime</scope>
    </dependency>
    
    <!-- Option B: OAuth2 Resource Server (auto JWKS validation) -->
    <dependency>
        <groupId>org.springframework.boot</groupId>
        <artifactId>spring-boot-starter-oauth2-resource-server</artifactId>
    </dependency>
    
    <!-- Database -->
    <dependency>
        <groupId>org.springframework.boot</groupId>
        <artifactId>spring-boot-starter-data-jpa</artifactId>
    </dependency>
    <dependency>
        <groupId>org.postgresql</groupId>
        <artifactId>postgresql</artifactId>
        <scope>runtime</scope>
    </dependency>
    
    <!-- Redis for Token Blacklisting & Rate Limiting -->
    <dependency>
        <groupId>org.springframework.boot</groupId>
        <artifactId>spring-boot-starter-data-redis</artifactId>
    </dependency>
    
    <!-- Validation -->
    <dependency>
        <groupId>org.springframework.boot</groupId>
        <artifactId>spring-boot-starter-validation</artifactId>
    </dependency>
</dependencies>
```
