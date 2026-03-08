
# Part 12: Microservices Security Architecture

## 12.1 Security Architecture

```
+-------+     +------------+     +----------+     +----------+
| Client| --> | API        | --> | Auth     | --> | User     |
| (SPA/ |     | Gateway    |     | Service  |     | DB       |
|  App) |     | (routes +  |     | (JWT     |     |          |
|       |     |  JWT valid)|     |  issuer) |     |          |
+-------+     +-----+------+     +----------+     +----------+
                    |
         +----------+----------+
         |          |          |
    +----v---+ +----v---+ +----v---+
    | Order  | | User   | | Payment|
    | Service| | Service| | Service|
    | (JWT   | | (JWT   | | (JWT   |
    |  valid)| |  valid)| |  valid)|
    +--------+ +--------+ +--------+
```

## 12.2 How It Works

```
Step 1: Client logs in via Auth Service
        POST /api/auth/login -> Auth Service validates credentials
        Returns JWT: { accessToken, refreshToken }

Step 2: Client sends API request with JWT
        GET /api/orders
        Authorization: Bearer eyJhbGci...

Step 3: API Gateway intercepts
        - Extracts JWT from header
        - Validates signature (does NOT call Auth Service)
        - Checks expiration
        - If valid: forwards request with user info headers
        - If invalid: returns 401

Step 4: Downstream service receives request
        - Reads user info from headers (set by Gateway)
        - OR validates JWT again (defense in depth)
        - Authorizes based on roles/permissions
```

## 12.3 API Gateway JWT Filter

```java
@Component
public class JwtGatewayFilter implements GatewayFilter {

    @Autowired private JwtService jwtService;

    @Override
    public Mono<Void> filter(ServerWebExchange exchange,
                              GatewayFilterChain chain) {
        String authHeader = exchange.getRequest()
            .getHeaders().getFirst("Authorization");

        if (authHeader == null || !authHeader.startsWith("Bearer ")) {
            exchange.getResponse().setStatusCode(HttpStatus.UNAUTHORIZED);
            return exchange.getResponse().setComplete();
        }

        String token = authHeader.substring(7);
        try {
            String username = jwtService.extractUsername(token);
            List<String> roles = jwtService.extractRoles(token);

            // Forward user info to downstream services
            ServerHttpRequest modifiedRequest = exchange.getRequest()
                .mutate()
                .header("X-User-Id", username)
                .header("X-User-Roles", String.join(",", roles))
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

## 12.4 Inter-Service Security

```
Service-to-Service Communication:

Option 1: Propagate user JWT
  Order Service -> Payment Service
  Forwards the original user JWT
  Payment Service validates the same token

Option 2: Service account JWT (Client Credentials)
  Order Service authenticates with its own credentials
  Gets a service-level JWT from Auth Service
  Uses service JWT to call Payment Service

Option 3: mTLS (Mutual TLS)
  Both services present certificates
  Verified at transport layer
  Used in service mesh (Istio)
```

```java
// Feign client that propagates JWT from the current request
@FeignClient(name = "payment-service",
             configuration = FeignAuthConfig.class)
public interface PaymentClient {
    @PostMapping("/api/payments")
    PaymentResponse processPayment(@RequestBody PaymentRequest request);
}

@Configuration
public class FeignAuthConfig {
    @Bean
    public RequestInterceptor authInterceptor() {
        return requestTemplate -> {
            // Get JWT from current SecurityContext
            ServletRequestAttributes attrs =
                (ServletRequestAttributes) RequestContextHolder
                    .getRequestAttributes();
            if (attrs != null) {
                String authHeader = attrs.getRequest()
                    .getHeader("Authorization");
                if (authHeader != null) {
                    requestTemplate.header("Authorization", authHeader);
                }
            }
        };
    }
}
```

---

# Part 13: Security Best Practices

## 13.1 Secure Password Storage

```java
// ALWAYS use BCrypt or Argon2
@Bean
public PasswordEncoder passwordEncoder() {
    return new BCryptPasswordEncoder(12);
}

// NEVER store plain text passwords
// NEVER use MD5 or SHA for passwords
// NEVER write your own hashing algorithm
```

## 13.2 CSRF Protection

```java
// For REST APIs (stateless, JWT): DISABLE CSRF
// JWT in Authorization header is not auto-sent by browser -> no CSRF risk
http.csrf(csrf -> csrf.disable());

// For traditional web apps (session-based): KEEP CSRF ENABLED
http.csrf(csrf -> csrf
    .csrfTokenRepository(CookieCsrfTokenRepository.withHttpOnlyFalse()));

// CSRF token is included in forms:
// <input type="hidden" name="_csrf" value="${_csrf.token}"/>
```

## 13.3 CORS Configuration

```java
@Bean
public CorsConfigurationSource corsConfigurationSource() {
    CorsConfiguration config = new CorsConfiguration();
    config.setAllowedOrigins(List.of(
        "https://myapp.com",
        "https://admin.myapp.com"
    ));
    config.setAllowedMethods(List.of("GET", "POST", "PUT", "DELETE"));
    config.setAllowedHeaders(List.of("Authorization", "Content-Type"));
    config.setAllowCredentials(true);
    config.setMaxAge(3600L);

    UrlBasedCorsConfigurationSource source =
        new UrlBasedCorsConfigurationSource();
    source.registerCorsConfiguration("/api/**", config);
    return source;
}

// In SecurityFilterChain:
http.cors(cors -> cors.configurationSource(corsConfigurationSource()));
```

## 13.4 Token Expiration Strategy

```
Access Token:  Short-lived (15 minutes)
  - Used for API authentication
  - If stolen, limited damage window
  - Client refreshes when expired

Refresh Token: Long-lived (7 days)
  - Used ONLY to get new access tokens
  - Stored securely (HttpOnly cookie)
  - Rotated on use (old one invalidated)
  - Revocable (stored in DB)

Token Rotation:
  1. Access token expires (15 min)
  2. Client sends refresh token to /auth/refresh
  3. Server issues new access token + new refresh token
  4. Old refresh token is invalidated
  5. If old refresh token is reused -> revoke ALL tokens (security alert)
```

## 13.5 Rate Limiting

```java
@Component
public class RateLimitFilter extends OncePerRequestFilter {

    private final Map<String, Bucket> buckets = new ConcurrentHashMap<>();

    @Override
    protected void doFilterInternal(HttpServletRequest request,
            HttpServletResponse response, FilterChain chain)
            throws ServletException, IOException {

        String clientIp = request.getRemoteAddr();
        Bucket bucket = buckets.computeIfAbsent(clientIp,
            k -> Bucket.builder()
                .addLimit(Bandwidth.classic(100,
                    Refill.intervally(100, Duration.ofMinutes(1))))
                .build());

        if (bucket.tryConsume(1)) {
            chain.doFilter(request, response);
        } else {
            response.setStatus(429);
            response.getWriter().write(
                "{\"error\": \"Too many requests\"}");
        }
    }
}
```

## 13.6 Security Headers

```java
http.headers(headers -> headers
    .frameOptions(frame -> frame.deny())                     // Clickjacking
    .contentTypeOptions(content -> content.disable())        // MIME sniffing
    .httpStrictTransportSecurity(hsts -> hsts                // HTTPS only
        .includeSubDomains(true)
        .maxAgeInSeconds(31536000))
    .xssProtection(xss -> xss.headerValue(
        XXssProtectionHeaderWriter.HeaderValue.ENABLED_MODE_BLOCK))
);
```

---

# Part 14: Production Security Challenges

## 14.1 Token Leaks

**Cause:** JWT stored in localStorage (accessible via XSS), leaked in URLs, or logged in server logs.

**Mitigation:**
| Strategy | How |
|---|---|
| Short expiry | Access token = 15 min. Limits damage. |
| HttpOnly cookies | Store tokens in HttpOnly cookies (no JS access) |
| Token blacklist | Maintain a blacklist in Redis for revoked tokens |
| Log sanitization | Never log authorization headers |

```java
// Token blacklist check
@Component
public class TokenBlacklistService {
    @Autowired private RedisTemplate<String, String> redis;

    public void blacklist(String token, long expiryMs) {
        redis.opsForValue().set("blacklist:" + token, "revoked",
            Duration.ofMillis(expiryMs));
    }

    public boolean isBlacklisted(String token) {
        return Boolean.TRUE.equals(redis.hasKey("blacklist:" + token));
    }
}
```

## 14.2 Session Hijacking

**Cause:** Attacker steals session cookie via XSS or network sniffing.

**Mitigation:**
- Use HTTPS everywhere (HSTS header)
- Set cookies as HttpOnly + Secure + SameSite=Strict
- Session fixation protection (regenerate session ID on login)
- Bind session to IP/User-Agent

```java
http.sessionManagement(session -> session
    .sessionFixation().migrateSession()  // New session ID on login
    .maximumSessions(1)                   // One session per user
    .maxSessionsPreventsLogin(true));      // Block new session if active
```

## 14.3 Replay Attacks

**Cause:** Attacker intercepts and resends a valid request.

**Mitigation:**
- Short-lived access tokens
- Include timestamp and nonce in requests
- Idempotency keys for critical operations
- Detect and block duplicate request IDs

## 14.4 Credential Stuffing

**Cause:** Attackers use leaked username/password lists from other sites.

**Mitigation:**
| Strategy | Implementation |
|---|---|
| Rate limiting | Max 5 failed logins per IP per minute |
| Account lockout | Lock after 5 failed attempts, unlock after 30 min |
| CAPTCHA | After 3 failed attempts |
| MFA | Require second factor for login |
| Password policy | Minimum 8 chars, check against common password list |

```java
@Service
public class LoginAttemptService {
    private final LoadingCache<String, Integer> attemptsCache;

    public LoginAttemptService() {
        attemptsCache = CacheBuilder.newBuilder()
            .expireAfterWrite(30, TimeUnit.MINUTES)
            .build(CacheLoader.from(() -> 0));
    }

    public void loginFailed(String key) {
        int attempts = attemptsCache.getUnchecked(key);
        attemptsCache.put(key, attempts + 1);
    }

    public boolean isBlocked(String key) {
        return attemptsCache.getUnchecked(key) >= 5;
    }

    public void loginSucceeded(String key) {
        attemptsCache.invalidate(key);
    }
}
```

## 14.5 Security Incident Response

```
1. DETECT: Monitor for anomalies
   - Failed login spikes
   - Unusual API patterns
   - Unauthorized access attempts

2. CONTAIN: Limit damage
   - Revoke compromised tokens
   - Lock affected accounts
   - Block suspicious IPs

3. INVESTIGATE: Find root cause
   - Review audit logs
   - Trace request chain
   - Identify vulnerability

4. REMEDIATE: Fix the issue
   - Patch vulnerability
   - Rotate secrets
   - Force password resets

5. RECOVER: Return to normal
   - Unlock accounts
   - Restore services
   - Notify affected users
```

---

# Part 15: Complete Spring Boot Security Project

## 15.1 Project Structure

```
secure-app/
|
+-- src/main/java/com/app/
|   |
|   +-- SecureAppApplication.java
|   |
|   +-- controller/
|   |   +-- AuthController.java          // Login, Register, Refresh
|   |   +-- UserController.java          // User CRUD
|   |   +-- AdminController.java         // Admin operations
|   |
|   +-- service/
|   |   +-- AuthService.java             // Authentication logic
|   |   +-- UserService.java             // User business logic
|   |   +-- TokenService.java            // Token management
|   |
|   +-- repository/
|   |   +-- UserRepository.java          // JPA User repository
|   |   +-- RoleRepository.java          // JPA Role repository
|   |   +-- RefreshTokenRepository.java  // Refresh token storage
|   |
|   +-- entity/
|   |   +-- User.java                    // User JPA entity
|   |   +-- Role.java                    // Role entity
|   |   +-- Permission.java             // Permission entity
|   |   +-- RefreshToken.java           // Refresh token entity
|   |
|   +-- security/
|   |   +-- SecurityConfig.java          // Security filter chain config
|   |   +-- JwtAuthenticationFilter.java // JWT validation filter
|   |   +-- JwtService.java             // JWT generation/validation
|   |   +-- CustomUserDetails.java      // UserDetails implementation
|   |   +-- CustomUserDetailsService.java// Load user from DB
|   |
|   +-- config/
|   |   +-- CorsConfig.java             // CORS settings
|   |   +-- OpenApiConfig.java          // Swagger security config
|   |
|   +-- dto/
|   |   +-- request/
|   |   |   +-- LoginRequest.java
|   |   |   +-- RegisterRequest.java
|   |   |   +-- RefreshTokenRequest.java
|   |   +-- response/
|   |       +-- AuthResponse.java
|   |       +-- UserResponse.java
|   |       +-- ApiResponse.java
|   |
|   +-- exception/
|   |   +-- GlobalExceptionHandler.java  // @ControllerAdvice
|   |   +-- InvalidTokenException.java
|   |   +-- UserAlreadyExistsException.java
|   |
|   +-- mapper/
|       +-- UserMapper.java              // Entity <-> DTO mapping
|
+-- src/main/resources/
|   +-- application.yml
|   +-- application-dev.yml
|   +-- application-prod.yml
|
+-- src/test/java/com/app/
|   +-- controller/
|   |   +-- AuthControllerTest.java
|   +-- security/
|       +-- JwtServiceTest.java
|
+-- pom.xml
```

## 15.2 Key Component Implementations

### Entity: User
```java
@Entity
@Table(name = "users")
@Getter @Setter @NoArgsConstructor
public class User {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(unique = true, nullable = false)
    private String email;

    @Column(nullable = false)
    private String passwordHash;

    private String firstName;
    private String lastName;
    private boolean active = true;
    private boolean locked = false;

    @ManyToMany(fetch = FetchType.EAGER)
    @JoinTable(name = "user_roles",
        joinColumns = @JoinColumn(name = "user_id"),
        inverseJoinColumns = @JoinColumn(name = "role_id"))
    private Set<Role> roles = new HashSet<>();

    @Column(updatable = false)
    private LocalDateTime createdAt;

    @PrePersist
    void onCreate() { createdAt = LocalDateTime.now(); }
}
```

### Security Configuration
```java
@Configuration
@EnableWebSecurity
@EnableMethodSecurity
@RequiredArgsConstructor
public class SecurityConfig {

    private final JwtAuthenticationFilter jwtFilter;
    private final CustomUserDetailsService userDetailsService;

    @Bean
    public SecurityFilterChain filterChain(HttpSecurity http) throws Exception {
        return http
            .csrf(csrf -> csrf.disable())
            .cors(cors -> cors.configurationSource(corsConfig()))
            .sessionManagement(session -> session
                .sessionCreationPolicy(SessionCreationPolicy.STATELESS))
            .authorizeHttpRequests(auth -> auth
                .requestMatchers("/api/auth/**").permitAll()
                .requestMatchers("/api/admin/**").hasRole("ADMIN")
                .requestMatchers("/api/users/me").authenticated()
                .anyRequest().authenticated()
            )
            .authenticationProvider(authProvider())
            .addFilterBefore(jwtFilter,
                UsernamePasswordAuthenticationFilter.class)
            .exceptionHandling(ex -> ex
                .authenticationEntryPoint((req, res, e) -> {
                    res.setStatus(401);
                    res.setContentType("application/json");
                    res.getWriter().write("{\"error\":\"Unauthorized\"}");
                })
                .accessDeniedHandler((req, res, e) -> {
                    res.setStatus(403);
                    res.setContentType("application/json");
                    res.getWriter().write("{\"error\":\"Forbidden\"}");
                })
            )
            .build();
    }

    @Bean
    public AuthenticationProvider authProvider() {
        DaoAuthenticationProvider provider = new DaoAuthenticationProvider();
        provider.setUserDetailsService(userDetailsService);
        provider.setPasswordEncoder(passwordEncoder());
        return provider;
    }

    @Bean
    public PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder(12);
    }

    @Bean
    public AuthenticationManager authManager(
            AuthenticationConfiguration config) throws Exception {
        return config.getAuthenticationManager();
    }
}
```

### Application Configuration
```yaml
# application.yml
spring:
  datasource:
    url: jdbc:mysql://localhost:3306/secureapp
    username: app_user
    password: ${DB_PASSWORD}
  jpa:
    hibernate:
      ddl-auto: validate
    properties:
      hibernate:
        dialect: org.hibernate.dialect.MySQLDialect

jwt:
  secret: ${JWT_SECRET}  # Base64-encoded 256-bit key
  access-token-expiration: 900000   # 15 minutes
  refresh-token-expiration: 604800000  # 7 days

server:
  port: 8080
```

---

# Part 16: Build It Yourself — JWT Authentication System

> **Goal:** Build a complete Spring Security JWT authentication system from scratch — registration, login, token issuance, and role-based access control.

## Concept Overview

```
Registration:  POST /api/auth/register → Save user (BCrypt password) → Return success
Login:         POST /api/auth/login    → Validate credentials → Return JWT
API Call:      GET /api/users/me       → JWT in header → JwtFilter validates → Return data
```

| Component | Purpose |
|---|---|
| `SecurityConfig` | Defines which URLs need auth, which are public |
| `JwtService` | Creates and validates JWT tokens |
| `JwtAuthenticationFilter` | Intercepts every request, extracts and validates JWT |
| `CustomUserDetailsService` | Loads user from database for Spring Security |
| `AuthController` | Login and register endpoints |

---

## Step 1: Add Dependencies

```xml
<dependency>
    <groupId>org.springframework.boot</groupId>
    <artifactId>spring-boot-starter-security</artifactId>
</dependency>
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
```

---

## Step 2: Create JwtService

**Concept:** JWT = Header.Payload.Signature. The server signs the token with a secret key. On each request, it validates the signature — no database lookup needed.

```java
@Service
public class JwtService {

    @Value("${jwt.secret}")
    private String secretKey;

    public String generateToken(UserDetails user) {
        return Jwts.builder()
            .subject(user.getUsername())
            .claim("roles", user.getAuthorities().stream()
                .map(GrantedAuthority::getAuthority).toList())
            .issuedAt(new Date())
            .expiration(new Date(System.currentTimeMillis() + 900_000))  // 15 min
            .signWith(getSigningKey())
            .compact();
    }

    public String extractUsername(String token) {
        return getClaims(token).getSubject();
    }

    public boolean isTokenValid(String token, UserDetails user) {
        return extractUsername(token).equals(user.getUsername())
            && !getClaims(token).getExpiration().before(new Date());
    }

    private Claims getClaims(String token) {
        return Jwts.parser().verifyWith(getSigningKey())
            .build().parseSignedClaims(token).getPayload();
    }

    private SecretKey getSigningKey() {
        return Keys.hmacShaKeyFor(Decoders.BASE64.decode(secretKey));
    }
}
```

---

## Step 3: Create JWT Authentication Filter

**Concept:** This filter runs BEFORE every request. It extracts the JWT from the `Authorization` header, validates it, and sets the authenticated user in Spring's SecurityContext.

```java
@Component
@RequiredArgsConstructor
public class JwtAuthenticationFilter extends OncePerRequestFilter {

    private final JwtService jwtService;
    private final CustomUserDetailsService userDetailsService;

    @Override
    protected void doFilterInternal(HttpServletRequest request,
            HttpServletResponse response, FilterChain chain)
            throws ServletException, IOException {

        String authHeader = request.getHeader("Authorization");
        if (authHeader == null || !authHeader.startsWith("Bearer ")) {
            chain.doFilter(request, response);       // No token → continue (might be public URL)
            return;
        }

        String token = authHeader.substring(7);
        String username = jwtService.extractUsername(token);

        if (username != null && SecurityContextHolder.getContext().getAuthentication() == null) {
            UserDetails user = userDetailsService.loadUserByUsername(username);
            if (jwtService.isTokenValid(token, user)) {
                UsernamePasswordAuthenticationToken auth =
                    new UsernamePasswordAuthenticationToken(user, null, user.getAuthorities());
                SecurityContextHolder.getContext().setAuthentication(auth);
            }
        }
        chain.doFilter(request, response);
    }
}
```

---

## Step 4: Configure Security

```java
@Configuration
@EnableWebSecurity
public class SecurityConfig {

    @Autowired private JwtAuthenticationFilter jwtFilter;

    @Bean
    public SecurityFilterChain filterChain(HttpSecurity http) throws Exception {
        return http
            .csrf(csrf -> csrf.disable())              // Disable CSRF for REST APIs
            .sessionManagement(s -> s
                .sessionCreationPolicy(SessionCreationPolicy.STATELESS))  // No sessions
            .authorizeHttpRequests(auth -> auth
                .requestMatchers("/api/auth/**").permitAll()   // Public: login, register
                .requestMatchers("/api/admin/**").hasRole("ADMIN")
                .anyRequest().authenticated())
            .addFilterBefore(jwtFilter,                // Add JWT filter to chain
                UsernamePasswordAuthenticationFilter.class)
            .build();
    }

    @Bean
    public PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder(12);          // BCrypt with strength 12
    }
}
```

---

## Step 5: Create Auth Controller

```java
@RestController
@RequestMapping("/api/auth")
@RequiredArgsConstructor
public class AuthController {

    private final AuthenticationManager authManager;
    private final JwtService jwtService;
    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;

    @PostMapping("/register")
    public ResponseEntity<String> register(@RequestBody RegisterRequest req) {
        User user = new User();
        user.setEmail(req.email());
        user.setPasswordHash(passwordEncoder.encode(req.password()));
        user.setRole(Role.USER);
        userRepository.save(user);
        return ResponseEntity.status(201).body("User registered");
    }

    @PostMapping("/login")
    public ResponseEntity<AuthResponse> login(@RequestBody LoginRequest req) {
        authManager.authenticate(
            new UsernamePasswordAuthenticationToken(req.email(), req.password()));
        UserDetails user = userDetailsService.loadUserByUsername(req.email());
        String token = jwtService.generateToken(user);
        return ResponseEntity.ok(new AuthResponse(token));
    }
}
```

---

## Step 6: Test the Flow

```bash
# Register
curl -X POST http://localhost:8080/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"user@test.com","password":"secret123"}'

# Login (get JWT)
curl -X POST http://localhost:8080/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"user@test.com","password":"secret123"}'
# Response: {"token":"eyJhbGciOiJIUzI1NiIs..."}

# Access protected endpoint
curl http://localhost:8080/api/users/me \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIs..."
```

---

## Key Takeaways

| Concept | Remember |
|---|---|
| JWT is stateless | Server doesn't store sessions — token contains all user info |
| BCrypt for passwords | Never store plain text; use strength 10-12 |
| Filter chain order | JwtFilter BEFORE UsernamePasswordAuthenticationFilter |
| `@PreAuthorize` | Method-level security: `@PreAuthorize("hasRole('ADMIN')")` |
| Token expiry | Access = 15 min, Refresh = 7 days, always short-lived |

---
