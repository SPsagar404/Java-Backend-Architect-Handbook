
# Part 7: JWT Authentication Architecture

## 7.1 What is JWT?

**JSON Web Token (JWT)** is a compact, self-contained token used for securely transmitting information between parties. It contains all user information needed for authentication -- no server-side session storage required.

## 7.2 JWT Structure

```
Header.Payload.Signature

eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJ1c2VyQG1haWwuY29tIiwicm9sZXMi...
|_______Header________|._________________Payload_________________|.Sig

HEADER (Algorithm + Type):
{
  "alg": "HS256",
  "typ": "JWT"
}

PAYLOAD (Claims - user data):
{
  "sub": "user@mail.com",        // Subject (username)
  "roles": ["ROLE_USER"],         // User roles
  "iat": 1709812345,              // Issued at
  "exp": 1709898745               // Expiration (24 hours)
}

SIGNATURE:
HMACSHA256(
  base64UrlEncode(header) + "." + base64UrlEncode(payload),
  secret_key
)
```

## 7.3 JWT Authentication Flow

```
1. LOGIN:
   Client                    Auth Server
     |  POST /auth/login       |
     |  { email, password }    |
     |------------------------>|
     |                         | Validate credentials
     |                         | Generate JWT token
     |  { accessToken,         |
     |    refreshToken }       |
     |<------------------------|

2. API CALLS:
   Client                    Resource Server
     |  GET /api/orders        |
     |  Authorization:         |
     |  Bearer eyJhbGci...     |
     |------------------------>|
     |                         | Extract JWT from header
     |                         | Validate signature
     |                         | Check expiration
     |                         | Extract user info
     |                         | Set SecurityContext
     |  { orders data }        |
     |<------------------------|

3. TOKEN REFRESH:
   Client                    Auth Server
     |  POST /auth/refresh     |
     |  { refreshToken }       |
     |------------------------>|
     |                         | Validate refresh token
     |                         | Issue new access token
     |  { newAccessToken }     |
     |<------------------------|
```

## 7.4 JWT Service Implementation

```java
@Service
public class JwtService {

    @Value("${jwt.secret}")
    private String secretKey;

    @Value("${jwt.access-token-expiration}")
    private long accessTokenExpiry;  // 15 minutes

    @Value("${jwt.refresh-token-expiration}")
    private long refreshTokenExpiry;  // 7 days

    public String generateAccessToken(UserDetails userDetails) {
        Map<String, Object> claims = new HashMap<>();
        claims.put("roles", userDetails.getAuthorities().stream()
            .map(GrantedAuthority::getAuthority)
            .collect(Collectors.toList()));
        return buildToken(claims, userDetails.getUsername(), accessTokenExpiry);
    }

    public String generateRefreshToken(UserDetails userDetails) {
        return buildToken(new HashMap<>(), userDetails.getUsername(),
                          refreshTokenExpiry);
    }

    private String buildToken(Map<String, Object> claims,
                               String subject, long expiry) {
        return Jwts.builder()
            .setClaims(claims)
            .setSubject(subject)
            .setIssuedAt(new Date())
            .setExpiration(new Date(System.currentTimeMillis() + expiry))
            .signWith(getSigningKey(), SignatureAlgorithm.HS256)
            .compact();
    }

    public String extractUsername(String token) {
        return extractClaim(token, Claims::getSubject);
    }

    public boolean isTokenValid(String token, UserDetails userDetails) {
        String username = extractUsername(token);
        return username.equals(userDetails.getUsername())
            && !isTokenExpired(token);
    }

    private boolean isTokenExpired(String token) {
        return extractClaim(token, Claims::getExpiration).before(new Date());
    }

    private <T> T extractClaim(String token, Function<Claims, T> resolver) {
        Claims claims = Jwts.parserBuilder()
            .setSigningKey(getSigningKey())
            .build()
            .parseClaimsJws(token)
            .getBody();
        return resolver.apply(claims);
    }

    private Key getSigningKey() {
        byte[] keyBytes = Decoders.BASE64.decode(secretKey);
        return Keys.hmacShaKeyFor(keyBytes);
    }
}
```

## 7.5 Auth Controller

```java
@RestController
@RequestMapping("/api/auth")
@RequiredArgsConstructor
public class AuthController {

    private final AuthenticationManager authManager;
    private final JwtService jwtService;
    private final UserDetailsService userDetailsService;
    private final UserService userService;

    @PostMapping("/login")
    public ResponseEntity<AuthResponse> login(@RequestBody LoginRequest request) {
        authManager.authenticate(
            new UsernamePasswordAuthenticationToken(
                request.getEmail(), request.getPassword()));

        UserDetails user = userDetailsService
            .loadUserByUsername(request.getEmail());
        String accessToken = jwtService.generateAccessToken(user);
        String refreshToken = jwtService.generateRefreshToken(user);

        return ResponseEntity.ok(new AuthResponse(accessToken, refreshToken));
    }

    @PostMapping("/register")
    public ResponseEntity<AuthResponse> register(
            @RequestBody @Valid RegisterRequest request) {
        UserDetails user = userService.register(request);
        String accessToken = jwtService.generateAccessToken(user);
        String refreshToken = jwtService.generateRefreshToken(user);
        return ResponseEntity.status(201)
            .body(new AuthResponse(accessToken, refreshToken));
    }

    @PostMapping("/refresh")
    public ResponseEntity<AuthResponse> refresh(
            @RequestBody RefreshRequest request) {
        String username = jwtService.extractUsername(request.getRefreshToken());
        UserDetails user = userDetailsService.loadUserByUsername(username);

        if (!jwtService.isTokenValid(request.getRefreshToken(), user)) {
            throw new InvalidTokenException("Invalid refresh token");
        }

        String newAccessToken = jwtService.generateAccessToken(user);
        return ResponseEntity.ok(
            new AuthResponse(newAccessToken, request.getRefreshToken()));
    }
}
```

---

# Part 8: Spring Security with OAuth2

## 8.1 OAuth2 Concepts

```
+----------+     +----------+     +----------+     +----------+
| Resource |     | Client   |     | Auth     |     | Resource |
| Owner    |     | App      |     | Server   |     | Server   |
| (User)   |     | (Your    |     | (Google/ |     | (Your    |
|          |     |  App)    |     |  GitHub) |     |  API)    |
+----------+     +----------+     +----------+     +----------+

Resource Owner: The user who owns the data
Client App: Your application requesting access
Authorization Server: Issues tokens (Google, GitHub, Keycloak)
Resource Server: Hosts protected resources (your API)
```

## 8.2 OAuth2 Flows

### Authorization Code Flow (Most Secure, Web Apps)
```
1. User clicks "Login with Google"
2. App redirects to Google's authorization page
3. User logs in to Google, grants permission
4. Google redirects back with authorization code
5. App exchanges code for access token (server-side)
6. App uses access token to get user info
7. App creates local session/JWT

    User             Your App              Google
     |  Click Login     |                     |
     |----------------->|                     |
     |                  |  Redirect to Google |
     |                  |-------------------->|
     |                  |                     | Login page
     |<---------------------------------------|
     |  Enter credentials                     |
     |--------------------------------------->|
     |                  |  Redirect + code    |
     |                  |<--------------------|
     |                  |  Exchange code      |
     |                  |-------------------->|
     |                  |  Access token       |
     |                  |<--------------------|
     |                  |  Get user info      |
     |                  |-------------------->|
     |                  |  User data          |
     |                  |<--------------------|
     |  Logged in!      |                     |
     |<-----------------|                     |
```

### Client Credentials Flow (Service-to-Service)
```
Service A                    Auth Server (Keycloak)
   |  POST /token              |
   |  grant_type=client_creds  |
   |  client_id + secret       |
   |-------------------------->|
   |  { access_token }         |
   |<--------------------------|
   |                           |
   |  GET /api/data            |  Service B
   |  Authorization: Bearer... |  (Resource Server)
   |-------------------------------------------->|
   |  { data }                                   |
   |<--------------------------------------------|
```

## 8.3 Spring Boot OAuth2 Configuration

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
          github:
            client-id: ${GITHUB_CLIENT_ID}
            client-secret: ${GITHUB_CLIENT_SECRET}
            scope: read:user, user:email
```

```java
@Configuration
@EnableWebSecurity
public class OAuth2SecurityConfig {

    @Bean
    public SecurityFilterChain filterChain(HttpSecurity http) throws Exception {
        return http
            .authorizeHttpRequests(auth -> auth
                .requestMatchers("/", "/login").permitAll()
                .anyRequest().authenticated()
            )
            .oauth2Login(oauth -> oauth
                .loginPage("/login")
                .userInfoEndpoint(userInfo ->
                    userInfo.userService(customOAuth2UserService))
                .successHandler(oAuth2SuccessHandler)
            )
            .build();
    }
}

@Service
public class CustomOAuth2UserService
        extends DefaultOAuth2UserService {

    @Autowired private UserRepository userRepository;

    @Override
    public OAuth2User loadUser(OAuth2UserRequest request)
            throws OAuth2AuthenticationException {
        OAuth2User oAuth2User = super.loadUser(request);
        String email = oAuth2User.getAttribute("email");
        String name = oAuth2User.getAttribute("name");
        String provider = request.getClientRegistration()
            .getRegistrationId(); // "google" or "github"

        // Find or create local user
        User user = userRepository.findByEmail(email)
            .orElseGet(() -> {
                User newUser = new User();
                newUser.setEmail(email);
                newUser.setName(name);
                newUser.setProvider(provider);
                newUser.setRole(Role.USER);
                return userRepository.save(newUser);
            });

        return new CustomOAuth2User(oAuth2User, user);
    }
}
```

---

# Part 9: Role-Based Access Control (RBAC)

## 9.1 Roles vs Authorities

```
ROLE: A group of permissions (coarse-grained)
  - ROLE_USER
  - ROLE_ADMIN
  - ROLE_MANAGER

AUTHORITY: A specific permission (fine-grained)
  - user:read
  - user:write
  - order:delete
  - report:export

Hierarchy:
  ROLE_ADMIN -> [user:read, user:write, user:delete,
                 order:read, order:write, order:delete,
                 report:read, report:export]
  ROLE_MANAGER -> [user:read, order:read, order:write,
                   report:read, report:export]
  ROLE_USER -> [user:read, order:read]
```

## 9.2 URL-Based Security

```java
@Bean
public SecurityFilterChain filterChain(HttpSecurity http) throws Exception {
    return http
        .authorizeHttpRequests(auth -> auth
            // Public endpoints
            .requestMatchers("/api/auth/**").permitAll()
            .requestMatchers(HttpMethod.GET, "/api/products/**").permitAll()

            // Role-based
            .requestMatchers("/api/admin/**").hasRole("ADMIN")
            .requestMatchers("/api/reports/**").hasAnyRole("ADMIN", "MANAGER")

            // Authority-based
            .requestMatchers(HttpMethod.DELETE, "/api/users/**")
                .hasAuthority("user:delete")
            .requestMatchers(HttpMethod.POST, "/api/orders/**")
                .hasAuthority("order:write")

            // Everything else requires authentication
            .anyRequest().authenticated()
        )
        .build();
}
```

## 9.3 Method-Level Security

```java
@Configuration
@EnableMethodSecurity  // Enables @PreAuthorize, @PostAuthorize, @Secured
public class MethodSecurityConfig { }

@Service
public class UserService {

    // @PreAuthorize: checked BEFORE method execution
    @PreAuthorize("hasRole('ADMIN')")
    public void deleteUser(Long userId) {
        userRepository.deleteById(userId);
    }

    // Access method parameters
    @PreAuthorize("hasRole('ADMIN') or #userId == authentication.principal.id")
    public User getUser(@Param("userId") Long userId) {
        return userRepository.findById(userId).orElseThrow();
    }

    // @PostAuthorize: checked AFTER method execution
    @PostAuthorize("returnObject.email == authentication.name")
    public User getMyProfile(Long userId) {
        return userRepository.findById(userId).orElseThrow();
    }

    // @Secured: simpler (no SpEL)
    @Secured({"ROLE_ADMIN", "ROLE_MANAGER"})
    public List<User> getAllUsers() {
        return userRepository.findAll();
    }

    // @RolesAllowed (JSR-250)
    @RolesAllowed("ADMIN")
    public void resetPassword(Long userId) {
        // admin operation
    }
}
```

## 9.4 Database Schema for RBAC

```sql
CREATE TABLE users (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    email VARCHAR(150) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    is_active BOOLEAN DEFAULT TRUE
);

CREATE TABLE roles (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(50) UNIQUE NOT NULL  -- ADMIN, USER, MANAGER
);

CREATE TABLE permissions (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) UNIQUE NOT NULL  -- user:read, order:write
);

CREATE TABLE user_roles (
    user_id BIGINT NOT NULL,
    role_id BIGINT NOT NULL,
    PRIMARY KEY (user_id, role_id),
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (role_id) REFERENCES roles(id)
);

CREATE TABLE role_permissions (
    role_id BIGINT NOT NULL,
    permission_id BIGINT NOT NULL,
    PRIMARY KEY (role_id, permission_id),
    FOREIGN KEY (role_id) REFERENCES roles(id),
    FOREIGN KEY (permission_id) REFERENCES permissions(id)
);
```

---

# Part 10: Security Filter Chain Deep Dive

## 10.1 Default Filter Execution Order

```
HTTP Request
     |
     v
+-------------------------------------------------------+
|                 SECURITY FILTER CHAIN                  |
|                                                         |
| 1. SecurityContextPersistenceFilter                    |
|    Load SecurityContext from session/storage            |
|                     |                                   |
| 2. HeaderWriterFilter                                  |
|    Add security headers (X-Frame-Options, etc.)        |
|                     |                                   |
| 3. CsrfFilter                                         |
|    Validate CSRF token for state-changing requests     |
|                     |                                   |
| 4. LogoutFilter                                        |
|    Handle /logout requests                             |
|                     |                                   |
| 5. UsernamePasswordAuthenticationFilter                |
|    Handle form login POST /login                       |
|    (or custom JWT filter inserted here)                |
|                     |                                   |
| 6. BasicAuthenticationFilter                           |
|    Handle HTTP Basic auth (Authorization: Basic ...)   |
|                     |                                   |
| 7. BearerTokenAuthenticationFilter                     |
|    Handle Bearer token (Authorization: Bearer ...)     |
|                     |                                   |
| 8. RequestCacheAwareFilter                             |
|    Restore previously cached request                   |
|                     |                                   |
| 9. SecurityContextHolderAwareRequestFilter             |
|    Wrap request with security methods                  |
|                     |                                   |
| 10. AnonymousAuthenticationFilter                      |
|     Create anonymous auth if not authenticated         |
|                     |                                   |
| 11. SessionManagementFilter                            |
|     Manage session creation policy                     |
|                     |                                   |
| 12. ExceptionTranslationFilter                         |
|     Catch and translate security exceptions            |
|     AuthenticationException -> 401                     |
|     AccessDeniedException -> 403                       |
|                     |                                   |
| 13. AuthorizationFilter                                |
|     Check if user has required role/authority           |
|     for the requested URL                              |
+-------------------------------------------------------+
     |
     v (if authorized)
Controller handles request
```

## 10.2 Custom Filter Registration

```java
@Bean
public SecurityFilterChain filterChain(HttpSecurity http) throws Exception {
    return http
        // ... configuration ...

        // Add JWT filter BEFORE the default authentication filter
        .addFilterBefore(jwtAuthFilter,
            UsernamePasswordAuthenticationFilter.class)

        // Add rate limiting filter BEFORE everything
        .addFilterBefore(rateLimitFilter,
            SecurityContextPersistenceFilter.class)

        // Add logging filter AFTER authentication
        .addFilterAfter(requestLoggingFilter,
            AuthorizationFilter.class)

        .build();
}
```

## 10.3 ExceptionTranslationFilter

```java
// Customizing authentication and access denied responses
@Bean
public SecurityFilterChain filterChain(HttpSecurity http) throws Exception {
    return http
        .exceptionHandling(ex -> ex
            .authenticationEntryPoint((request, response, exception) -> {
                response.setStatus(401);
                response.setContentType("application/json");
                response.getWriter().write(
                    "{\"error\": \"Authentication required\", " +
                    "\"message\": \"" + exception.getMessage() + "\"}");
            })
            .accessDeniedHandler((request, response, exception) -> {
                response.setStatus(403);
                response.setContentType("application/json");
                response.getWriter().write(
                    "{\"error\": \"Access denied\", " +
                    "\"message\": \"Insufficient permissions\"}");
            })
        )
        .build();
}
```

---

# Part 11: Session-Based vs Token-Based Authentication

## 11.1 Comparison

```
SESSION-BASED:                       TOKEN-BASED (JWT):

Client                Server          Client                Server
  |  Login              |              |  Login              |
  |-------------------->|              |-------------------->|
  |  Set-Cookie:        |              |  { accessToken,     |
  |  JSESSIONID=abc123  |              |    refreshToken }   |
  |<--------------------|              |<--------------------|
  |                      |              |                      |
  |  GET /api/data      |              |  GET /api/data      |
  |  Cookie: abc123     |              |  Authorization:     |
  |-------------------->|              |  Bearer eyJhbG...   |
  |  Server looks up    |              |-------------------->|
  |  session in memory  |              |  Server validates   |
  |  or Redis           |              |  token signature    |
  |  { data }           |              |  (no DB lookup)     |
  |<--------------------|              |  { data }           |
                                       |<--------------------|
```

| Aspect | Session-Based | Token-Based (JWT) |
|---|---|---|
| **Storage** | Server-side (memory/Redis) | Client-side (localStorage/cookie) |
| **Scalability** | Requires sticky sessions or shared session store | Stateless, any server can handle |
| **Mobile support** | Cookie management, complex | Straightforward, header-based |
| **Revocation** | Easy (delete session) | Hard (need blacklist or short expiry) |
| **Performance** | Session lookup per request | Signature verification (no DB hit) |
| **Size** | Small cookie (~32 bytes) | Larger token (~500+ bytes) |
| **CSRF risk** | Vulnerable (cookie-based) | Not vulnerable (header-based) |
| **Best for** | Traditional web apps (MVC) | REST APIs, microservices, SPAs |

## 11.2 Spring Security Configuration

```java
// SESSION-BASED (default)
@Bean
public SecurityFilterChain sessionConfig(HttpSecurity http) throws Exception {
    return http
        .sessionManagement(session ->
            session.sessionCreationPolicy(SessionCreationPolicy.IF_REQUIRED)
                   .maximumSessions(1)  // Only 1 active session per user
                   .expiredUrl("/login?expired"))
        .formLogin(form -> form
            .loginPage("/login")
            .defaultSuccessUrl("/dashboard"))
        .build();
}

// TOKEN-BASED (stateless)
@Bean
public SecurityFilterChain tokenConfig(HttpSecurity http) throws Exception {
    return http
        .csrf(csrf -> csrf.disable())  // No CSRF needed for stateless
        .sessionManagement(session ->
            session.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
        .addFilterBefore(jwtFilter,
            UsernamePasswordAuthenticationFilter.class)
        .build();
}
```

---
