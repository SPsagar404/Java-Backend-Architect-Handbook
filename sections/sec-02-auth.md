# Part 7: JWT Authentication Architecture (Architect's Deep Dive)

## 7.1 What is JWT?

**JSON Web Token (JWT)** is an open standard (RFC 7519) that defines a compact and self-contained way for securely transmitting information between parties as a JSON object.

### Deep Concept Explanation

**WHAT:** JWT is a cryptographically signed JSON document that carries verifiable claims about a user's identity and permissions. Unlike session IDs (which are random strings that reference server-side storage), JWTs are SELF-CONTAINED — the token itself carries all the information the server needs to authorize the request.

**WHY it exists:** In traditional session-based authentication, the server stores session data in memory (or Redis). When you scale to 10 servers, all 10 must share session storage (sticky sessions or distributed cache). JWT eliminates this entirely — the token itself IS the proof of authentication. Any server with the signing key can validate it independently.

**WHEN to use JWT:**
- REST APIs consumed by SPAs (React/Angular) or mobile apps
- Microservices architectures where multiple services need to verify identity
- Third-party API authentication
- Cross-domain single sign-on (SSO)

**WHEN NOT to use JWT:**
- Server-rendered MVC apps with Thymeleaf/JSP (sessions are simpler)
- When immediate token revocation is critical (e.g., banking terminals)
- When the payload would be too large (JWTs are sent in EVERY request header)

**WHERE it is used in real-world systems:**
- **E-commerce platforms:** Mobile app and web SPA both call the same stateless REST APIs
- **Microservices:** API Gateway validates JWT, forwards claims to downstream services
- **IoT systems:** Devices authenticate with long-lived JWTs without needing session management
- **SaaS platforms:** Cross-tenant SSO using JWTs issued by a central auth server

### Why JWT Over Session-Based Authentication
| Feature | Session-Based | JWT | Architect's Consideration |
|---|---|---|---|
| **Storage** | Server memory / Redis | Client-side only | JWT saves massive Redis infrastructure costs for high-scale apps. |
| **Scaling** | Sticky sessions needed | Any server validates | True statelessness; perfect for horizontal auto-scaling. |
| **Network** | Fast (small Cookie) | Slower (Large Header) | JWT size matters. Too many claims = bloated HTTP requests. |
| **Revocation** | Instant (delete session) | Difficult (requires blacklist) | JWTs are valid until `exp`. Revocation requires extra Redis hops. |
| **Cross-Domain** | Requires shared cookie domain | Works across ANY domain | JWT excels in cross-origin, multi-service environments |
| **Mobile Apps** | Complex cookie management | Simple header attachment | Mobile apps universally prefer JWT |

### Real-World Production Scenario: Choosing JWT vs Sessions

```
Scenario: An e-commerce company has:
  - A React web SPA running on https://shop.example.com
  - An iOS app
  - An Android app
  - A Spring Boot backend on https://api.example.com
  
Senior Engineer's Thinking:
  1. "Three different clients (web, iOS, Android) consume the same REST API."
  2. "React SPA is on a different domain — sessions + cookies require CORS  
      complexity and SameSite workarounds."
  3. "Mobile apps don't natively support cookies well — JWT in Auth header is simpler."
  4. "We plan to add microservices later (Order Service, Payment Service)."
  5. "Decision: Use JWT. It gives us stateless, cross-platform, scalable auth."
```

### Monolithic vs Microservices: JWT Behavior Differences

```
MONOLITHIC APPLICATION:
  Client -> POST /api/auth/login -> Monolith issues JWT (HS256, shared secret)
  Client -> GET /api/orders -> Same Monolith validates JWT
  
  - Single secret key stored in application.yml
  - Only one application signs AND verifies tokens
  - Simple, fast, sufficient for most monolithic apps

MICROSERVICES ARCHITECTURE:
  Client -> POST /api/auth/login -> Auth Service issues JWT (RS256, private key)
  Client -> GET /api/orders -> API Gateway validates JWT (public key via JWKS)
                             -> Order Service validates JWT (same public key)
  
  - Private key is ONLY in the Auth Service (guarded secret)
  - All other services use the Public Key (safe to distribute)
  - JWKS endpoint enables automatic key rotation without deployments
```

---

## 7.2 Architect's Dilemma: Symmetric vs Asymmetric Signatures

The most critical architectural decision regarding JWTs is how to secure the signature.

### Option A: Symmetric Signing (HS256 - HMAC SHA-256)
- **Mechanics:** The **same secret key** is used to both *sign* the token (Auth Server) and *verify* the token (Resource Server/API Gateway).
- **Pros:** Fast, simple to implement (`jjwt-api`).
- **Cons (The Architect's nightmare):** Every microservice that needs to verify the token MUST have a copy of the secret key. If one downstream microservice is compromised, the secret key leaks, allowing the attacker to mint fake tokens and compromise the entire cluster.

### Option B: Asymmetric Signing (RS256 - RSA Signature)
- **Mechanics:** Uses a Public/Private key pair. The **Private Key** signs the token (Auth Server only). The **Public Key** verifies it (All other microservices).
- **Pros:** Downstream services only hold the Public Key. Even if hacked, they cannot create fake tokens!
- **Cons:** Slower verification, requires PKI/Key management.

### The Enterprise Solution: JWKS (JSON Web Key Set)
In a modern microservices architecture (like Keycloak + Spring Boot), the Auth server exposes its Public Keys via a standard HTTP endpoint (e.g., `/.well-known/jwks.json`). Downstream Spring Boot REST APIs cache these keys and verify RS256 JWTs automatically without any shared secrets.

If a key is compromised, the Auth Server generates a new Private/Public key pair (Key Rotation) and publishes the new Public Key to the JWKS endpoint. Spring Security automatically fetches the new key!

### Internal Working: How JWKS Key Rotation Works

```
Timeline of Zero-Downtime Key Rotation:

Day 0: Auth Server signs all JWTs with Key Pair A (kid="key-A")
       JWKS endpoint returns: [PublicKey-A]
       All microservices cache PublicKey-A

Day 30: Security team decides to rotate keys
        Auth Server generates Key Pair B
        
Day 30: Auth Server starts signing NEW tokens with Key Pair B (kid="key-B")
        JWKS endpoint now returns: [PublicKey-A, PublicKey-B]  ← BOTH keys!
        
Day 30-31: Some tokens in-flight still use kid="key-A"
           Some new tokens use kid="key-B"
           Microservices see kid="key-B", don't have it cached
           -> Fetch updated JWKS -> Get PublicKey-B -> Cache it
           -> Continue validating both old and new tokens
           
Day 31: All key-A tokens have expired (15 min access tokens)
        Auth Server removes PublicKey-A from JWKS
        JWKS endpoint returns: [PublicKey-B]
        
Result: Zero downtime. No deployments. No config changes in any microservice.
```

### Real-World Production Scenario: Securing File Upload API with JWT

```
Scenario: Users upload profile pictures to POST /api/files/upload

Senior Engineer's Thinking:
  1. "The upload endpoint must be authenticated — only logged-in users can upload."
  2. "I need the userId from the JWT to associate the file with the correct user."
  3. "Max file size is 5MB. I should validate this BEFORE processing."
  4. "The JWT must have the 'file:write' authority/scope."
  5. "After upload, store the file in S3 and save the URL in the DB."

Implementation:
  @PostMapping("/upload")
  @PreAuthorize("hasAuthority('file:write')")
  public ResponseEntity<FileResponse> upload(@RequestParam MultipartFile file) {
      // Extract userId from SecurityContext (populated by JwtFilter)
      Long userId = ((CustomUserDetails) SecurityContextHolder.getContext()
          .getAuthentication().getPrincipal()).getId();
      
      String url = fileService.uploadToS3(file, userId);
      return ResponseEntity.ok(new FileResponse(url));
  }
```

---

## 7.3 JWT Structure & Claims

```
Header.Payload.Signature

eyJhbGciOiJSUzI1NiIsImtpZCI6IjEyMyJ9.eyJzdWIiOiJ1c2VyQG1haWwuY29tIn0.Sig...
```

**Header:** Contains Algorithm (`RS256`) and Key ID (`kid` - tells the server which public key from the JWKS to use).
**Payload (Claims):**
- `sub` (Subject): the user identifier.
- `iat` (Issued At): epoch time.
- `exp` (Expiration): epoch time.
- `iss` (Issuer): URL of the Auth Server. Prevent tokens from *Dev* being used in *Prod*.
- `aud` (Audience): Who is the token intended for? Prevents Token Substitution attacks.

### Deep Dive: Custom Claims and Token Size Impact

**Standard (Registered) Claims** are defined in RFC 7519:
```json
{
  "sub": "user@mail.com",
  "iss": "https://auth.mycompany.com",
  "aud": "https://api.mycompany.com",
  "iat": 1710144000,
  "exp": 1710144900,
  "jti": "a1b2c3d4-unique-token-id"
}
```

**Custom (Private) Claims** carry application-specific data:
```json
{
  "sub": "user@mail.com",
  "roles": ["ROLE_ADMIN", "ROLE_MANAGER"],
  "tenantId": 42,
  "permissions": ["order:read", "order:write", "user:delete"],
  "department": "Engineering"
}
```

**Architect's Warning: Token Bloat**
Every claim increases the JWT size. The JWT is sent as an HTTP header on EVERY request. If your token has 50 custom claims, it could be 4KB+ per request. For high-throughput APIs handling 10,000 requests/second, that's 40MB/s of extra network overhead just for tokens.

**Rule of Thumb:** Keep JWTs under 1KB. Include only: `sub`, `roles`, `tenantId`, `exp`, `iss`, `jti`. Fetch additional user details from the database or a User Profile API when needed.

### Security Pitfalls: JWT Claims

| Mistake | Risk | Fix |
|---|---|---|
| Not validating `iss` (Issuer) | Dev environment tokens work in Production | Always verify `iss` matches your Production Auth Server URL |
| Not validating `aud` (Audience) | Token issued for Service A works on Service B | Each service should check `aud` matches its own identifier |
| Storing sensitive data in JWT payload | Anyone can decode a JWT (it's Base64, NOT encrypted) | Never put passwords, SSN, credit cards in JWT claims |
| Not setting `jti` (JWT ID) | Cannot revoke specific tokens or detect replay | Always include `jti` for blacklisting and idempotency |
| Not validating `exp` before processing | Expired tokens accepted by buggy custom validation | Use the library's built-in expiration check (jjwt, nimbus) |

---

## 7.4 JWT Service Implementation (Symmetric Example)

```java
@Service
public class JwtService {

    @Value("${jwt.secret}")
    private String secretKey;

    @Value("${jwt.access-token-expiration}")
    private long accessTokenExpiry;  // 15 minutes max!

    @Value("${jwt.refresh-token-expiration}")
    private long refreshTokenExpiry;  // 7 days

    public String generateAccessToken(UserDetails userDetails) {
        Map<String, Object> claims = new HashMap<>();
        claims.put("roles", userDetails.getAuthorities().stream()
            .map(GrantedAuthority::getAuthority).toList());
            
        return Jwts.builder()
            .setClaims(claims)
            .setSubject(userDetails.getUsername())
            .setIssuedAt(new Date())
            .setExpiration(new Date(System.currentTimeMillis() + accessTokenExpiry))
            .signWith(getSigningKey(), SignatureAlgorithm.HS256)
            .compact();
    }

    public boolean isTokenValid(String token, UserDetails userDetails) {
        String username = extractUsername(token);
        return username.equals(userDetails.getUsername()) && !isTokenExpired(token);
    }
    
    // Architect Note: The parsing step validates the cryptographic signature.
    // If an attacker altered the payload, `parseClaimsJws` will throw an Exception!
    private Claims extractAllClaims(String token) {
        return Jwts.parserBuilder()
            .setSigningKey(getSigningKey())
            .build()
            .parseClaimsJws(token)
            .getBody();
    }
}
```

### Step-by-Step: Complete JwtAuthenticationFilter Implementation

```java
@Component
@RequiredArgsConstructor
public class JwtAuthenticationFilter extends OncePerRequestFilter {

    private final JwtService jwtService;
    private final UserDetailsService userDetailsService;

    @Override
    protected void doFilterInternal(HttpServletRequest request,
            HttpServletResponse response, FilterChain filterChain)
            throws ServletException, IOException {

        // Step 1: Extract the Authorization header
        final String authHeader = request.getHeader("Authorization");
        if (authHeader == null || !authHeader.startsWith("Bearer ")) {
            // No JWT present; continue chain (public endpoint or will fail at AuthorizationFilter)
            filterChain.doFilter(request, response);
            return;
        }

        // Step 2: Extract the token (remove "Bearer " prefix)
        final String jwt = authHeader.substring(7);

        // Step 3: Extract username from token claims
        final String username = jwtService.extractUsername(jwt);

        // Step 4: Only authenticate if not already authenticated (avoid double processing)
        if (username != null && SecurityContextHolder.getContext().getAuthentication() == null) {
            
            // Step 5: Load user from database (or cache)
            UserDetails userDetails = userDetailsService.loadUserByUsername(username);

            // Step 6: Validate token (signature + expiration + username match)
            if (jwtService.isTokenValid(jwt, userDetails)) {
                
                // Step 7: Create authenticated token with authorities
                UsernamePasswordAuthenticationToken authToken =
                    new UsernamePasswordAuthenticationToken(
                        userDetails, null, userDetails.getAuthorities());
                
                // Step 8: Attach request details (IP, session info)
                authToken.setDetails(
                    new WebAuthenticationDetailsSource().buildDetails(request));

                // Step 9: Set authentication in SecurityContext
                // Now AuthorizationFilter will see this user as authenticated!
                SecurityContextHolder.getContext().setAuthentication(authToken);
            }
        }

        // Step 10: Continue the filter chain
        filterChain.doFilter(request, response);
    }

    @Override
    protected boolean shouldNotFilter(HttpServletRequest request) {
        // Performance optimization: skip JWT filter for public endpoints
        String path = request.getServletPath();
        return path.startsWith("/api/auth/") || path.startsWith("/api/public/");
    }
}
```

### Real-World Production Scenario: Refresh Token Flow

```
Complete Token Lifecycle in Production:

1. User logs in:
   POST /api/auth/login -> Returns: { accessToken (15 min), refreshToken (7 days) }
   
2. Client stores both tokens:
   - accessToken: in memory (JavaScript variable) — NEVER in localStorage!
   - refreshToken: in HttpOnly Secure cookie — invisible to JavaScript (XSS-proof)
   
3. Client makes API calls:
   GET /api/orders  
   Authorization: Bearer <accessToken>
   
4. After 15 minutes, accessToken expires:
   GET /api/orders -> 401 Unauthorized (token expired)
   
5. Client silently refreshes:
   POST /api/auth/refresh
   Cookie: refreshToken=<refreshToken>
   -> Auth Server validates the refresh token
   -> Issues a NEW accessToken (+ optionally rotates refresh token)
   -> Returns: { accessToken (15 min), refreshToken (7 days - NEW) }
   
6. Client retries the original request with the new accessToken.
   GET /api/orders -> 200 OK

7. When user clicks "Logout":
   POST /api/auth/logout
   -> Server blacklists BOTH tokens in Redis
   -> Clears the refreshToken cookie
```

```java
// Refresh Token Endpoint
@PostMapping("/refresh")
public ResponseEntity<AuthResponse> refresh(
        @CookieValue(name = "refreshToken") String refreshToken) {
    
    // Validate the refresh token
    if (!jwtService.isTokenValid(refreshToken)) {
        throw new BadCredentialsException("Invalid or expired refresh token");
    }
    
    // Check if refresh token is blacklisted (user logged out)
    String jti = jwtService.extractJti(refreshToken);
    if (redisTemplate.hasKey("blacklist:" + jti)) {
        throw new BadCredentialsException("Refresh token has been revoked");
    }
    
    // Issue new tokens
    String username = jwtService.extractUsername(refreshToken);
    UserDetails user = userDetailsService.loadUserByUsername(username);
    String newAccessToken = jwtService.generateAccessToken(user);
    String newRefreshToken = jwtService.generateRefreshToken(user);
    
    // Rotate: blacklist the OLD refresh token
    long remainingTtl = jwtService.extractExpiration(refreshToken).getTime() 
                        - System.currentTimeMillis();
    redisTemplate.opsForValue().set("blacklist:" + jti, "revoked",
        remainingTtl, TimeUnit.MILLISECONDS);
    
    // Set new refresh token as HttpOnly cookie
    ResponseCookie cookie = ResponseCookie.from("refreshToken", newRefreshToken)
        .httpOnly(true).secure(true).sameSite("Strict")
        .path("/api/auth").maxAge(Duration.ofDays(7)).build();
    
    return ResponseEntity.ok()
        .header(HttpHeaders.SET_COOKIE, cookie.toString())
        .body(new AuthResponse(newAccessToken));
}
```

---

# Part 8: Spring Security with OAuth2 & OIDC

### The Grand Misconception: Identity vs Authorization
Many developers confuse **OAuth2** with an Authentication Protocol. It is NOT.

* **OAuth2 is a delegated AUTHORIZATION protocol.** (The user gives an App permission to access their Google Calendar via Scopes).
* **OpenID Connect (OIDC)** is an IDENTITY protocol built on top of OAuth2. It adds an **ID Token** (a JWT) alongside the OAuth2 Access Token. (The user proves WHO they are to the App).

### Deep Concept Explanation: OAuth2 vs OIDC Internals

**WHAT:** 
- **OAuth2** answers: "Is this Application allowed to access this User's data?" (Delegated AUTHORIZATION)
- **OIDC** answers: "WHO is this User?" (AUTHENTICATION/IDENTITY)

**WHY this distinction matters:**
A pure OAuth2 Access Token tells you *nothing* about the user's identity. It only says: "This application is allowed to read the user's email." To know WHO the user is, you need OIDC's `ID Token` — a JWT containing `sub` (user ID), `name`, `email`, `picture`, etc.

**Real-World Confusion Example:**
```
Scenario: Your Spring Boot app uses "Login with Google" button.
  
WRONG approach (OAuth2 only):
  1. User clicks "Login with Google"
  2. You receive an Access Token
  3. You call Google's API: GET https://www.googleapis.com/oauth2/v2/userinfo
  4. You get the user's profile — but you made an extra API call!

CORRECT approach (OIDC):
  1. User clicks "Login with Google"
  2. You receive BOTH an Access Token AND an ID Token (JWT)
  3. The ID Token ALREADY contains sub, email, name, picture
  4. No extra API call needed! Parse the ID Token locally.
```

**WHEN to use OAuth2 vs OIDC:**
| Scenario | Use |
|---|---|
| "Login with Google/GitHub" | OIDC (you need to know WHO the user is) |
| "Allow Slack to post to my channel" | OAuth2 (Slack needs permission, not identity) |
| "SSO across microservices with Keycloak" | OIDC (Keycloak returns ID tokens) |
| "GitHub Actions accessing AWS resources" | OAuth2 Client Credentials (machine-to-machine) |

---

### 8.1 OAuth2 / OIDC Roles
1. **Resource Owner:** The human user.
2. **Client Application:** Your Spring Boot Application.
3. **Authorization Server:** Keycloak, Auth0, Google, GitHub.
4. **Resource Server:** Your internal REST API.

### Internal Working: Complete Authorization Code Flow

```
Step 1: User clicks "Login with Google" on your React SPA
        Browser redirects to:
        https://accounts.google.com/authorize?
          client_id=YOUR_APP_ID
          &redirect_uri=https://yourapp.com/callback
          &response_type=code
          &scope=openid profile email
          &state=random_csrf_string

Step 2: User sees Google's consent screen
        "YourApp wants to access your email and profile"
        User clicks "Allow"

Step 3: Google redirects back to YOUR app with an Authorization Code
        https://yourapp.com/callback?code=AUTH_CODE_123&state=random_csrf_string
        
Step 4: Your Spring Boot backend exchanges the code for tokens
        POST https://oauth2.googleapis.com/token
        Body: {
          code: AUTH_CODE_123,
          client_id: YOUR_APP_ID,
          client_secret: YOUR_SECRET,    ← Server-to-server, never exposed!
          redirect_uri: https://yourapp.com/callback,
          grant_type: authorization_code
        }
        
Step 5: Google returns tokens
        {
          access_token: "ya29...",          ← For calling Google APIs
          id_token: "eyJhbGci...",          ← JWT with user identity (OIDC)
          refresh_token: "1//04dX...",      ← For getting new access tokens
          token_type: "Bearer",
          expires_in: 3600
        }

Step 6: Your app parses the ID Token to get user info
        { sub: "118234123", email: "user@gmail.com", name: "John" }
        
Step 7: Your app creates/updates a local user record
        Generates YOUR app's own JWT for subsequent API calls
```

---

### 8.2 Scope vs Role (Architectural Clarity)
In an enterprise deployment, do not confuse `Roles` with `Scopes`.

* **Role (RBAC):** `ROLE_ADMIN`, `ROLE_MANAGER`. Defines what the User is allowed to do within the system. Checked via `@PreAuthorize("hasRole('ADMIN')")`.
* **Scope (OAuth2):** `read:profile`, `write:orders`. Defines what the *Client Application* is allowed to do ON BEHALF OF the User. Checked via `@PreAuthorize("hasAuthority('SCOPE_read:profile')")`.

If a User is an `ADMIN` but logs in via a third-party App that only requested `read:profile` scope, the token should be rejected for `DELETE` operations, despite the User's inherent admin role. The *App* doesn't have the scope!

### Real-World Production Scenario: Combining Scopes and Roles

```
Scenario: Enterprise CRM with a public API for third-party integrations.

Internal Admin Dashboard (Thymeleaf/React):
  - User logs in directly via Keycloak OIDC
  - Token contains roles: [ROLE_ADMIN]
  - Token contains scopes: [openid, profile, ALL permissions]
  - Admin can delete customers: @PreAuthorize("hasRole('ADMIN')")
  
Third-party Zapier Integration:
  - Zapier authenticates via OAuth2 Authorization Code Flow
  - User grants Zapier only the "read:contacts" scope
  - Token contains roles: [ROLE_ADMIN]  (user IS an admin)
  - Token contains scopes: [read:contacts]  (app only has read access)
  - Zapier tries to DELETE a customer -> REJECTED!
    @PreAuthorize("hasRole('ADMIN') AND hasAuthority('SCOPE_write:contacts')")
    -> User has ROLE_ADMIN ✓ but app doesn't have SCOPE_write:contacts ✗
```

---

## 8.3 OAuth2 Resource Server Configuration (The Modern Way)

When using Keycloak or Auth0, your Spring Boot Application acts as a `Resource Server`. It does NOT mint tokens. It only verifies them using JWKS!

```yaml
# application.yml -> No secrets required! Only the JWKS URL.
spring:
  security:
    oauth2:
      resourceserver:
        jwt:
          issuer-uri: https://auth.mycompany.com/realms/enterprise
          jwk-set-uri: https://auth.mycompany.com/realms/enterprise/protocol/openid-connect/certs
```

```java
@Configuration
@EnableWebSecurity
public class OAuth2ResourceServerConfig {

    @Bean
    public SecurityFilterChain filterChain(HttpSecurity http) throws Exception {
        return http
            .authorizeHttpRequests(auth -> auth
                .requestMatchers("/api/public/**").permitAll()
                .anyRequest().authenticated()
            )
            // Spring magically handles RS256 token verification via JWKS!
            .oauth2ResourceServer(oauth2 -> oauth2.jwt())
            .build();
    }
}
```

### Step-by-Step: Custom JWT Claims Mapping from Keycloak

By default, Keycloak stores roles inside `realm_access.roles` in the JWT. Spring Security doesn't read that path automatically. You need a custom `JwtAuthenticationConverter`:

```java
@Bean
public JwtAuthenticationConverter jwtAuthenticationConverter() {
    JwtGrantedAuthoritiesConverter grantedAuthoritiesConverter = 
        new JwtGrantedAuthoritiesConverter();
    grantedAuthoritiesConverter.setAuthoritiesClaimName("realm_access.roles");
    grantedAuthoritiesConverter.setAuthorityPrefix("ROLE_");

    JwtAuthenticationConverter converter = new JwtAuthenticationConverter();
    converter.setJwtGrantedAuthoritiesConverter(jwt -> {
        // Extract roles from Keycloak's nested JWT structure
        Map<String, Object> realmAccess = jwt.getClaimAsMap("realm_access");
        if (realmAccess == null) return Collections.emptyList();
        
        List<String> roles = (List<String>) realmAccess.get("roles");
        return roles.stream()
            .map(role -> new SimpleGrantedAuthority("ROLE_" + role.toUpperCase()))
            .collect(Collectors.toList());
    });
    return converter;
}

// Usage in SecurityFilterChain:
.oauth2ResourceServer(oauth2 -> oauth2
    .jwt(jwt -> jwt.jwtAuthenticationConverter(jwtAuthenticationConverter())))
```

---

# Part 9: Role-Based Access Control (RBAC)

### What is RBAC?
**Role-Based Access Control** assigns permissions through **roles** rather than directly to users. 

### Deep Concept Explanation

**WHAT:** RBAC is an access control model where users are assigned to roles, and roles are assigned permissions. The user never interacts with permissions directly — they inherit them through their role assignment.

**WHY RBAC is the enterprise standard:** Without RBAC, managing permissions for 10,000 users requires individually assigning each permission to each user. With RBAC, you assign a user one role (e.g., `MANAGER`), and all 15 permissions associated with that role are automatically inherited. When a new permission is added to the role, all 500 managers get it instantly.

**WHERE RBAC is used in real-world systems:**
- **Hospital systems:** `DOCTOR` can view all patient records, `NURSE` can view assigned patients only, `RECEPTIONIST` can view appointment schedules
- **E-commerce:** `CUSTOMER` can place orders, `VENDOR` can manage inventory, `ADMIN` can manage everything
- **Financial systems:** `TELLER` can process transactions under $10K, `MANAGER` can approve transactions over $10K

### Design Pattern: Two-Level Authorization
Spring Security supports both coarse-grained (role) and fine-grained (authority) access control:
- **URL-based security** (coarse) — configured in `SecurityFilterChain`
- **Method-level security** (fine) — `@PreAuthorize`, `@Secured` annotations

---

## 9.1 Roles vs Authorities

```
ROLE: A grouping of permissions (coarse-grained)
  - ROLE_USER, ROLE_ADMIN

AUTHORITY / PERMISSION: A specific action (fine-grained)
  - order:read, order:write, user:delete

Hierarchy Strategy (Architect's Approach):
  ROLE_ADMIN -> [user:read, user:delete, order:read, order:write, report:export]
  ROLE_MANAGER -> [user:read, order:read, order:write, report:export]
  ROLE_USER -> [order:read]
```

### Internal Working: How Spring Security Stores Roles vs Authorities

Both `roles` and `authorities` are stored as `GrantedAuthority` objects inside the `Authentication` object. Spring appends `ROLE_` prefix automatically when you use `hasRole()`:

```java
// These two are EQUIVALENT:
.hasRole("ADMIN")           // Spring internally checks for "ROLE_ADMIN"
.hasAuthority("ROLE_ADMIN") // Direct authority check (no prefix magic)

// These are DIFFERENT:
.hasRole("ADMIN")           // Looks for authority string "ROLE_ADMIN"
.hasAuthority("ADMIN")      // Looks for authority string "ADMIN" (without ROLE_ prefix)
```

### Real-World Production Scenario: Database-Driven RBAC

```java
// JPA Entity Model for dynamic RBAC
@Entity
public class UserEntity {
    @Id @GeneratedValue
    private Long id;
    private String email;
    private String passwordHash;
    
    @ManyToMany(fetch = FetchType.EAGER)
    @JoinTable(name = "user_roles")
    private Set<RoleEntity> roles;
}

@Entity
public class RoleEntity {
    @Id @GeneratedValue
    private Long id;
    private String name; // ADMIN, MANAGER, USER
    
    @ManyToMany(fetch = FetchType.EAGER)
    @JoinTable(name = "role_permissions")
    private Set<PermissionEntity> permissions;
}

@Entity
public class PermissionEntity {
    @Id @GeneratedValue
    private Long id;
    private String name; // order:read, order:write, user:delete
}

// In CustomUserDetails constructor:
public CustomUserDetails(UserEntity user) {
    this.authorities = new ArrayList<>();
    for (RoleEntity role : user.getRoles()) {
        // Add the role itself
        authorities.add(new SimpleGrantedAuthority("ROLE_" + role.getName()));
        // Add all permissions belonging to this role
        for (PermissionEntity perm : role.getPermissions()) {
            authorities.add(new SimpleGrantedAuthority(perm.getName()));
        }
    }
}
// Result: authorities = [ROLE_ADMIN, order:read, order:write, user:delete, ...]
```

---

## 9.2 URL-Based Security

```java
@Bean
public SecurityFilterChain filterChain(HttpSecurity http) throws Exception {
    return http
        .authorizeHttpRequests(auth -> auth
            // Public endpoints
            .requestMatchers("/api/auth/**").permitAll()

            // Coarse Role-based
            .requestMatchers("/api/admin/**").hasRole("ADMIN")

            // Fine-grained Authority-based. Even if you are an ADMIN, 
            // you must explicitly have the order:write authority mapped.
            .requestMatchers(HttpMethod.POST, "/api/orders/**")
                .hasAuthority("order:write")

            .anyRequest().authenticated()
        )
        .build();
}
```

### Security Pitfall: Ordering of URL Matchers

URL matchers are evaluated in ORDER (top-to-bottom). The FIRST match wins. This is a very common source of bugs:

```java
// WRONG ORDER: Everything matches the first rule!
.authorizeHttpRequests(auth -> auth
    .anyRequest().authenticated()           // ← Matches EVERYTHING first!
    .requestMatchers("/api/public/**").permitAll()  // ← NEVER reached!
)

// CORRECT ORDER: Specific rules first, catch-all last
.authorizeHttpRequests(auth -> auth
    .requestMatchers("/api/public/**").permitAll()   // ← Specific first
    .requestMatchers("/api/admin/**").hasRole("ADMIN")
    .anyRequest().authenticated()                     // ← Catch-all last
)
```

---

## 9.3 Method-Level Security (AOP Based)

Method security utilizes Aspect-Oriented Programming (AOP). Spring proxies your beans and checks permissions *before* (or *after*) executing the actual code.

```java
@Configuration
@EnableMethodSecurity  // Replaces deprecated @EnableGlobalMethodSecurity
public class MethodSecurityConfig { }

@Service
public class UserService {

    // Checked BEFORE method execution via SpEL (Spring Expression Language)
    @PreAuthorize("hasRole('ADMIN')")
    public void deleteUser(Long userId) {
        userRepository.deleteById(userId);
    }

    // Advanced: Business Logic in Security! (ABAC - Attribute Based Access Control)
    // Only an ADMIN, OR the user requesting their own profile can execute this.
    @PreAuthorize("hasRole('ADMIN') or #userId == authentication.principal.id")
    public User getUser(@Param("userId") Long userId) {
        return userRepository.findById(userId).orElseThrow();
    }
}
```

### Deep Concept Explanation: How AOP-Based Security Works Internally

```
1. Spring Boot starts and scans @EnableMethodSecurity
2. Spring creates a BeanPostProcessor that intercepts bean creation
3. For every @Service/@Component with @PreAuthorize annotations:
   - Spring creates a PROXY (either JDK Dynamic Proxy or CGLIB subclass)
   - The proxy wraps the original bean
4. When code calls userService.deleteUser(42):
   - The call hits the PROXY first (not the real method)
   - The proxy evaluates the SpEL expression: hasRole('ADMIN')
   - If the current Authentication.getAuthorities() contains ROLE_ADMIN -> PROCEED
   - If not -> throw AccessDeniedException (403)
5. After @PreAuthorize passes, the REAL method executes

IMPORTANT GOTCHA: If you call deleteUser() from within the SAME class,
the proxy is BYPASSED! This is a well-known Spring AOP limitation.

// THIS WILL NOT CHECK SECURITY:
@Service
public class UserService {
    public void someMethod() {
        this.deleteUser(42);  // Direct internal call = proxy is bypassed!
    }
    
    @PreAuthorize("hasRole('ADMIN')")
    public void deleteUser(Long id) { ... }
}

// FIX: Inject the bean into itself or use AopContext
```

### Real-World Production Scenario: Multi-Tenant Data Isolation

```java
// Ensuring users can ONLY access data belonging to their tenant
@Service
@RequiredArgsConstructor
public class OrderService {
    
    private final OrderRepository orderRepository;
    
    @PreAuthorize("hasRole('USER')")
    public List<Order> getOrders() {
        // Extract tenant from SecurityContext
        TenantAwareUserDetails user = (TenantAwareUserDetails) 
            SecurityContextHolder.getContext().getAuthentication().getPrincipal();
        
        // CRITICAL: Always filter by tenantId!
        // Without this, User A could see User B's orders from a different company!
        return orderRepository.findByTenantId(user.getTenantId());
    }
    
    @PostAuthorize("returnObject.tenantId == authentication.principal.tenantId")
    public Order getOrderById(Long orderId) {
        // @PostAuthorize runs AFTER the method returns
        // If the returned Order belongs to a different tenant -> 403 Forbidden
        return orderRepository.findById(orderId).orElseThrow();
    }
}
```

---

# Part 10: Security Filter Chain Deep Dive & Internal Mechanics

### Why Understanding the Filter Chain Matters
- To add **custom authentication** (JWT filter), you must know WHERE to insert it.
- To debug security issues, you need to understand WHICH filter is rejecting the request.

### 10.1 Default Filter Execution Order

```
HTTP Request
     |
     v
+-------------------------------------------------------+
| 1. SecurityContextPersistenceFilter                    |
|    Load SecurityContext from JVM ThreadLocal            |
|                     |                                   |
| 2. HeaderWriterFilter                                  |
|    Add security headers (Strict-Transport-Security)    |
|                     |                                   |
| 3. CsrfFilter                                         |
|    Validate CSRF token for state-changing endpoints    |
|                     |                                   |
| 4. LogoutFilter                                        |
|    Intercepts POST /logout and invalidates session     |
|                     |                                   |
| 5. UsernamePasswordAuthenticationFilter                |
|    (Your custom JWT Filter goes BEFORE this one usually)|
|                     |                                   |
| 6. BearerTokenAuthenticationFilter                     |
|    OAuth2 Resource Server JWT Validator                |
|                     |                                   |
| 11. SessionManagementFilter                            |
|     Verifies concurrency, prevents session fixation    |
|                     |                                   |
| 12. ExceptionTranslationFilter                         |
|     CATCHES EXCEPTIONS thrown heavily down the chain   |
|     AuthnException -> 401, AccessDeniedException -> 403|
|                     |                                   |
| 13. AuthorizationFilter                                |
|     Evaluates URL matchers defined in authorizeHttpReqs|
+-------------------------------------------------------+
     |
     v (if authorized)
Controller handles request
```

### Deep Concept Explanation: Why Filter Ordering is Critical

**WHERE your custom JWT filter must be placed:**
```java
// Your JwtFilter BEFORE UsernamePasswordAuthenticationFilter
.addFilterBefore(jwtFilter, UsernamePasswordAuthenticationFilter.class)
```

**WHY `addFilterBefore(UsernamePasswordAuthenticationFilter.class)`?**
Because `UsernamePasswordAuthenticationFilter` only handles form-login POST requests to `/login`. Your JWT filter needs to run BEFORE it so that JWT-based requests are authenticated first. If your JWT filter runs AFTER the authorization filter, requests hit the authorization check with `principal = null` and get immediately rejected with 403.

### Real-World Debugging: Common Filter Chain Issues

```
Problem 1: "My JwtFilter runs but the request still returns 401"
  Debug: Is the SecurityContext cleared between requests?
  Check: Are you using SessionCreationPolicy.STATELESS?
  If not, Spring may try to load a session that doesn't exist.

Problem 2: "CORS preflight OPTIONS request returns 403"
  Debug: The OPTIONS request has NO Authorization header
  Fix: Ensure CorsFilter runs BEFORE the security chain
  http.cors(cors -> cors.configurationSource(...))
  AND: .requestMatchers(HttpMethod.OPTIONS, "/**").permitAll()

Problem 3: "My custom filter runs TWICE per request"
  Debug: You registered the filter both as a @Component (auto-scanned)
         AND via addFilterBefore() in the SecurityConfig
  Fix: Either remove @Component from the filter OR use a 
       FilterRegistrationBean to disable auto-registration
```

```java
// Fix for double-registration of custom filters
@Bean
public FilterRegistrationBean<JwtAuthenticationFilter> jwtFilterRegistration(
        JwtAuthenticationFilter filter) {
    FilterRegistrationBean<JwtAuthenticationFilter> registration = 
        new FilterRegistrationBean<>(filter);
    registration.setEnabled(false); // Prevent Servlet container from auto-registering
    return registration;
}
```

---

## 10.2 ExceptionTranslationFilter Explained

Why do you see a default Spring Boot login page when you browse to a secured URL without being authenticated?

The `AuthorizationFilter` (#13) sees you aren't authenticated and throws an `AccessDeniedException`. 
The `ExceptionTranslationFilter` (#12) catches it! It realizes you aren't authenticated, so it triggers the `AuthenticationEntryPoint`, which by default returns an `HTTP 302 Redirect to /login`!

If you are building a REST API, you don't want an HTML page returned. You must override the entry points!

```java
@Bean
public SecurityFilterChain filterChain(HttpSecurity http) throws Exception {
    return http
        .exceptionHandling(ex -> ex
            .authenticationEntryPoint((request, response, exception) -> {
                response.setStatus(401); // Halt the redirect! Return JSON!
                response.setContentType("application/json");
                response.getWriter().write("{\"error\": \"Authentication Required\"}");
            })
            .accessDeniedHandler((request, response, exception) -> {
                response.setStatus(403);
                response.setContentType("application/json");
                response.getWriter().write("{\"error\": \"Insufficient Privileges\"}");
            })
        )
        .build();
}
```

### Real-World Production Scenario: Structured Error Responses

In production, you want structured error responses with error codes, timestamps, and request paths:

```java
@Component
public class CustomAuthenticationEntryPoint implements AuthenticationEntryPoint {
    
    private final ObjectMapper objectMapper = new ObjectMapper();
    
    @Override
    public void commence(HttpServletRequest request, HttpServletResponse response,
            AuthenticationException exception) throws IOException {
        
        response.setStatus(HttpServletResponse.SC_UNAUTHORIZED);
        response.setContentType(MediaType.APPLICATION_JSON_VALUE);
        
        Map<String, Object> errorBody = Map.of(
            "timestamp", Instant.now().toString(),
            "status", 401,
            "error", "Unauthorized",
            "message", "Authentication is required to access this resource",
            "path", request.getRequestURI()
        );
        
        objectMapper.writeValue(response.getOutputStream(), errorBody);
    }
}
```

---

# Part 11: Session-Based vs Token-Based Authentication

### 11.1 Advanced Session Management (Session Registry)

In monolithic (Session-based) architectures, how do you prevent a user from logging in on 5 different devices at once?

Spring Security utilizes the `SessionRegistry` to track active sessions across the JVM.

### Deep Concept Explanation

**WHAT:** Session management controls HOW the server maintains user state between HTTP requests. In session-based auth, the server stores user data in memory (or Redis) and sends a `JSESSIONID` cookie to the browser. The browser sends this cookie on every subsequent request.

**WHY sessions still exist in the JWT era:** Not every application needs stateless JWT. Server-rendered MVC apps (Thymeleaf, JSP), admin dashboards, and internal tools are simpler and more secure with sessions because:
- Instant revocation (delete the session = user is immediately logged out)
- No token size concerns (the cookie is tiny)
- No client-side token storage risks (HttpOnly cookies are immune to XSS)

**WHEN to use sessions vs tokens:**
| Criteria | Use Sessions | Use JWT |
|---|---|---|
| App type | Server-rendered (Thymeleaf/JSP) | REST API + SPA/Mobile |
| Scaling | Single server or Redis-backed sessions | Horizontally scaled, stateless |
| Revocation | Immediate logout is critical | Short-lived tokens are acceptable |
| Clients | Browser only | Browser + Mobile + Third-party |

```java
@Bean
public SecurityFilterChain sessionConfig(HttpSecurity http) throws Exception {
    return http
        .sessionManagement(session -> session
            .sessionCreationPolicy(SessionCreationPolicy.IF_REQUIRED)
            // Session Fixation Defense: Generate a brand NEW JSESSIONID upon login
            .sessionFixation().migrateSession()
            // Concurrency Control: Only 1 active login allowed across all browsers
            .maximumSessions(1)
            // If true, the second login attempt throws an error. 
            // If false, the first login is aggressively invalidated.
            .maxSessionsPreventsLogin(true)
            .expiredUrl("/login?expired=true")
        )
        .build();
}
```
*Architect's Note:* If you scale this app to 3 EC2 instances, the `SessionRegistry` exists in local memory. Concurrency control will BREAK unless you implement Spring Session distributed backed by Redis (`@EnableRedisHttpSession`).

### Monolithic vs Microservices: Session Management

```
MONOLITHIC (Session-Based):
  Client -> POST /login -> Server creates JSESSIONID, stores in memory/Redis
  Client -> GET /dashboard -> Server reads JSESSIONID cookie, loads session
  
  Scaling:
  - 1 server: Works perfectly with in-memory sessions
  - 3 servers behind Load Balancer:
    Option A: Sticky sessions (LB routes same user to same server) — fragile
    Option B: Spring Session + Redis (sessions stored centrally) — recommended
    Option C: Switch to JWT (eliminate sessions entirely) — best for new projects

MICROSERVICES (Token-Based):
  Client -> POST /auth/login -> Auth Service generates JWT
  Client -> GET /api/orders -> Order Service validates JWT (no session needed)
  Client -> GET /api/profile -> User Service validates JWT (no session needed)
  
  Each service is independently stateless.
  No shared session storage required.
  Each service caches JWKS keys for JWT validation.
```

---

### 11.2 Stateless (Token-Based) Configuration

```java
@Bean
public SecurityFilterChain tokenConfig(HttpSecurity http) throws Exception {
    return http
        // Token Architectures are immune to CSRF if implemented properly via Headers
        .csrf(csrf -> csrf.disable())  
        .sessionManagement(session ->
            // Prevents Spring Security from creating a JSESSIONID entirely
            session.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
        // Must inject custom JWT reader
        .addFilterBefore(jwtFilter, UsernamePasswordAuthenticationFilter.class)
        .build();
}
```

### Real-World Production Scenario: Handling Token Expiration Gracefully

```
Scenario: A user is filling out a long form (30 min). Their access token
          expires after 15 min. When they submit the form -> 401 error!

Senior Engineer's Solution:
  1. Frontend interceptor (Axios/Fetch) catches 401 responses
  2. BEFORE showing an error, attempt a silent token refresh:
     - Call POST /api/auth/refresh with the refresh token cookie
     - If successful: retry the original request with the new access token
     - If refresh fails (refresh token expired too): redirect to login page
  
This is called "Silent Refresh" or "Token Rotation."
The user NEVER sees the 401. The form submission succeeds transparently.
```

### Interview Questions: Session vs Token Architecture

**Q: If your JWT-based REST API accidentally creates a JSESSIONID cookie, what went wrong?**
*Answer:* You forgot to set `SessionCreationPolicy.STATELESS`. Without this, Spring Security creates a session by default after authentication. The fix is adding `.sessionManagement(s -> s.sessionCreationPolicy(SessionCreationPolicy.STATELESS))`.

**Q: Can you use BOTH session-based and token-based authentication in the same application?**
*Answer:* Yes! Configure two separate `SecurityFilterChain` beans with different `securityMatcher()` patterns. The admin dashboard chain uses form-login with sessions. The API chain uses JWT with stateless sessions. Spring matches the incoming URL to the correct chain.
