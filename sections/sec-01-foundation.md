# Mastering Spring Security -- Authentication, Authorization, and Enterprise Security Architecture Guide

---

**Author:** Senior Java Security Architect
**Target Audience:** Java backend developers with 3+ years experience aiming for architect-level Spring Security expertise
**Prerequisites:** Core Java, Spring Boot, REST APIs, basic security concepts

---

# Table of Contents

1. Spring Security Fundamentals
2. Spring Security Architecture Internals
3. Complete Authentication Flow
4. Authentication Providers
5. UserDetails and UserDetailsService Deep Dive
6. Password Security and Encoding
7. JWT Authentication Architecture
8. Spring Security with OAuth2
9. Role-Based Access Control (RBAC)
10. Security Filter Chain Deep Dive
11. Session-Based vs Token-Based Authentication
12. Microservices Security Architecture
13. Security Best Practices
14. Production Security Challenges
15. Complete Spring Boot Security Project
16. Interview Questions (100+)
17. Hands-on Practice Exercises

---

# Part 1: Spring Security Fundamentals

## 1.1 What is Spring Security?

**Spring Security** is a powerful, highly customizable authentication and access-control framework for Java applications. It is the de-facto standard for securing Spring-based applications.

Spring Security provides:
- **Authentication:** Verifying who you are (login)
- **Authorization:** Verifying what you can do (permissions)
- **Protection:** Against common security exploits (CSRF, XSS, session fixation)

## 1.2 Why Spring Security?

| Need | How Spring Security Helps |
|---|---|
| User login | Multiple authentication mechanisms (form, JWT, OAuth2) |
| API protection | Secure REST endpoints with token-based auth |
| Role-based access | Fine-grained method and URL security |
| Password safety | Built-in BCrypt, Argon2 password encoders |
| Attack prevention | CSRF protection, CORS, headers security |
| Extensibility | Fully customizable filter chain |

## 1.3 Common Security Threats

| Threat | Description | Spring Security Defense |
|---|---|---|
| **SQL Injection** | Malicious SQL in input | JPA/Hibernate parameterized queries |
| **Cross-Site Scripting (XSS)** | Injecting scripts into pages | Response header security |
| **CSRF** | Forged requests from other sites | CSRF token validation |
| **Session Hijacking** | Stealing session cookies | Session fixation protection |
| **Brute Force** | Guessing passwords repeatedly | Account lockout, rate limiting |
| **Credential Stuffing** | Using leaked credentials | Password encoding, MFA |
| **Man-in-the-Middle** | Intercepting network traffic | HTTPS enforcement (HSTS) |

## 1.4 Authentication vs Authorization

```
AUTHENTICATION (AuthN):              AUTHORIZATION (AuthZ):
"Who are you?"                       "What can you do?"

+----------+     +-----------+       +----------+     +-----------+
| Username | --> | Verify    |       | User     | --> | Check     |
| Password |     | Identity  |       | Role     |     | Permission|
+----------+     +-----------+       +----------+     +-----------+
                      |                                     |
              Valid/Invalid                          Allowed/Denied

Examples:                            Examples:
- Login with email + password        - ADMIN can delete users
- Login with Google (OAuth2)         - USER can view own profile
- Login with fingerprint             - MANAGER can approve orders
```

---

# Part 2: Spring Security Architecture Internals

## 2.1 Architecture Diagram

```
HTTP Request
     |
     v
+------------------------------------------------------------------+
|                   SECURITY FILTER CHAIN                           |
|                                                                    |
|  +-------------------+                                            |
|  | Security Context  |  Stores authenticated user info            |
|  | Persistence Filter|  (loads SecurityContext from session)       |
|  +-------------------+                                            |
|           |                                                        |
|  +-------------------+                                            |
|  | CSRF Filter       |  Validates CSRF token                      |
|  +-------------------+                                            |
|           |                                                        |
|  +-------------------+                                            |
|  | Authentication    |  UsernamePasswordAuthenticationFilter      |
|  | Filter            |  OR BearerTokenAuthenticationFilter        |
|  +-------------------+                                            |
|           |                                                        |
|           v                                                        |
|  +-------------------+     +------------------------+             |
|  | Authentication    | --> | Authentication         |             |
|  | Manager           |     | Provider               |             |
|  | (ProviderManager) |     | (DaoAuthProvider)      |             |
|  +-------------------+     +------------------------+             |
|                                     |                              |
|                            +--------+--------+                    |
|                            |                 |                    |
|                   +--------v-----+   +-------v--------+          |
|                   |UserDetails   |   |Password        |          |
|                   |Service       |   |Encoder         |          |
|                   |(loads user)  |   |(verifies pwd)  |          |
|                   +--------------+   +----------------+          |
|           |                                                        |
|  +-------------------+                                            |
|  | Exception         |  Handles AuthenticationException           |
|  | Translation Filter|  and AccessDeniedException                 |
|  +-------------------+                                            |
|           |                                                        |
|  +-------------------+                                            |
|  | Authorization     |  Checks roles/authorities                  |
|  | Filter            |  for the requested URL                    |
|  +-------------------+                                            |
+------------------------------------------------------------------+
     |
     v
Controller (if authorized)
```

## 2.2 Core Components

### SecurityFilterChain
```java
@Configuration
@EnableWebSecurity
public class SecurityConfig {

    @Bean
    public SecurityFilterChain filterChain(HttpSecurity http) throws Exception {
        return http
            .csrf(csrf -> csrf.disable())  // Disable for REST APIs
            .sessionManagement(session ->
                session.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
            .authorizeHttpRequests(auth -> auth
                .requestMatchers("/api/auth/**").permitAll()
                .requestMatchers("/api/admin/**").hasRole("ADMIN")
                .requestMatchers("/api/**").authenticated()
            )
            .addFilterBefore(jwtFilter, UsernamePasswordAuthenticationFilter.class)
            .build();
    }
}
```

### AuthenticationManager
**What:** Central interface for authentication. Receives an Authentication request and returns a fully authenticated object.

```java
@Bean
public AuthenticationManager authenticationManager(
        AuthenticationConfiguration config) throws Exception {
    return config.getAuthenticationManager();
}
```

### AuthenticationProvider
**What:** Performs the actual authentication logic. The AuthenticationManager delegates to one or more providers.

### SecurityContext and SecurityContextHolder
```java
// After authentication, the user's details are stored:
SecurityContext context = SecurityContextHolder.getContext();
Authentication auth = context.getAuthentication();
String username = auth.getName();
Collection<? extends GrantedAuthority> authorities = auth.getAuthorities();

// Spring stores this per-thread using ThreadLocal
// Available throughout the request lifecycle
```

---

# Part 3: Complete Authentication Flow

## 3.1 Step-by-Step Flow

```
Step 1: Client sends login request
        POST /api/auth/login
        { "email": "user@mail.com", "password": "secret123" }
              |
              v
Step 2: Request hits Security Filter Chain
        UsernamePasswordAuthenticationFilter intercepts
        Creates UsernamePasswordAuthenticationToken (unauthenticated)
              |
              v
Step 3: AuthenticationManager receives token
        Delegates to configured AuthenticationProvider(s)
              |
              v
Step 4: DaoAuthenticationProvider processes authentication
        Calls UserDetailsService.loadUserByUsername("user@mail.com")
              |
              v
Step 5: UserDetailsService loads user from database
        Returns UserDetails object with:
        - username, passwordHash, authorities, accountStatus
              |
              v
Step 6: Password validation
        PasswordEncoder.matches("secret123", "$2a$10$...")
        BCrypt compares raw password with stored hash
              |
              v
Step 7: If valid: Create authenticated token
        UsernamePasswordAuthenticationToken (authenticated = true)
        Contains: principal, authorities
              |
              v
Step 8: SecurityContextHolder stores authentication
        SecurityContextHolder.getContext().setAuthentication(authToken)
              |
              v
Step 9: Generate response (JWT token or session)
        Return JWT to client for stateless auth
        Or create HTTP session for stateful auth
```

## 3.2 Authentication Token States

```java
// BEFORE authentication (unauthenticated):
UsernamePasswordAuthenticationToken token =
    new UsernamePasswordAuthenticationToken(email, password);
// token.isAuthenticated() == false
// token.getPrincipal() == "user@mail.com" (username)
// token.getCredentials() == "secret123" (password)

// AFTER authentication (authenticated):
UsernamePasswordAuthenticationToken authToken =
    new UsernamePasswordAuthenticationToken(userDetails, null, authorities);
// authToken.isAuthenticated() == true
// authToken.getPrincipal() == UserDetails object
// authToken.getCredentials() == null (cleared for security)
// authToken.getAuthorities() == [ROLE_USER, ROLE_ADMIN]
```

---

# Part 4: Authentication Providers

## 4.1 DaoAuthenticationProvider (Most Common)

**What:** Authenticates using a UserDetailsService and PasswordEncoder.
**When:** Username/password authentication against a database.

```java
@Bean
public AuthenticationProvider daoAuthProvider() {
    DaoAuthenticationProvider provider = new DaoAuthenticationProvider();
    provider.setUserDetailsService(userDetailsService);
    provider.setPasswordEncoder(passwordEncoder());
    return provider;
}
```

## 4.2 JwtAuthenticationProvider (Custom)

**What:** Validates JWT tokens from request headers.
**When:** Stateless REST API authentication.

```java
// Custom JWT Authentication Filter
@Component
public class JwtAuthenticationFilter extends OncePerRequestFilter {

    @Autowired private JwtService jwtService;
    @Autowired private UserDetailsService userDetailsService;

    @Override
    protected void doFilterInternal(HttpServletRequest request,
            HttpServletResponse response, FilterChain chain)
            throws ServletException, IOException {

        String authHeader = request.getHeader("Authorization");
        if (authHeader == null || !authHeader.startsWith("Bearer ")) {
            chain.doFilter(request, response);
            return;
        }

        String token = authHeader.substring(7);
        String username = jwtService.extractUsername(token);

        if (username != null && SecurityContextHolder.getContext()
                .getAuthentication() == null) {

            UserDetails userDetails = userDetailsService
                .loadUserByUsername(username);

            if (jwtService.isTokenValid(token, userDetails)) {
                UsernamePasswordAuthenticationToken authToken =
                    new UsernamePasswordAuthenticationToken(
                        userDetails, null, userDetails.getAuthorities());
                authToken.setDetails(
                    new WebAuthenticationDetailsSource()
                        .buildDetails(request));
                SecurityContextHolder.getContext()
                    .setAuthentication(authToken);
            }
        }
        chain.doFilter(request, response);
    }
}
```

## 4.3 OAuth2 Authentication Provider

**What:** Authenticates using external OAuth2 providers (Google, GitHub).
**When:** "Login with Google" or SSO.

## 4.4 LDAP Authentication Provider

**What:** Authenticates against an LDAP directory (Active Directory).
**When:** Enterprise environments with centralized user directories.

## 4.5 RememberMe Authentication Provider

**What:** Authenticates using a persistent remember-me token.
**When:** "Keep me logged in" functionality.

## 4.6 Anonymous Authentication Provider

**What:** Creates an anonymous authentication token for unauthenticated requests.
**When:** Allowing certain pages to be publicly accessible while still having a SecurityContext.

## 4.7 Pre-Authenticated Authentication Provider

**What:** Trusts authentication already done by an external system (API Gateway, SSO).
**When:** Behind a reverse proxy that has already validated the user.

| Provider | Use Case | Authentication Source |
|---|---|---|
| DaoAuthenticationProvider | Database login | UserDetailsService + PasswordEncoder |
| Custom JwtAuthProvider | REST API auth | JWT token in Authorization header |
| OAuth2AuthProvider | Social login | Google, GitHub, Microsoft |
| LdapAuthProvider | Enterprise SSO | Active Directory / LDAP |
| RememberMeProvider | Persistent login | Cookie token |
| AnonymousProvider | Public pages | Auto-generated anonymous token |
| PreAuthProvider | Gateway-authenticated | Trusted headers from proxy |

---

# Part 5: UserDetails and UserDetailsService

## 5.1 UserDetails Interface

```java
public interface UserDetails extends Serializable {
    Collection<? extends GrantedAuthority> getAuthorities();
    String getPassword();
    String getUsername();
    boolean isAccountNonExpired();
    boolean isAccountNonLocked();
    boolean isCredentialsNonExpired();
    boolean isEnabled();
}
```

## 5.2 Custom UserDetails Implementation

```java
@Getter
public class CustomUserDetails implements UserDetails {

    private final Long id;
    private final String email;
    private final String password;
    private final String fullName;
    private final Collection<? extends GrantedAuthority> authorities;
    private final boolean active;
    private final boolean locked;

    public CustomUserDetails(User user) {
        this.id = user.getId();
        this.email = user.getEmail();
        this.password = user.getPasswordHash();
        this.fullName = user.getFirstName() + " " + user.getLastName();
        this.authorities = user.getRoles().stream()
            .map(role -> new SimpleGrantedAuthority("ROLE_" + role.getName()))
            .collect(Collectors.toList());
        this.active = user.isActive();
        this.locked = user.isLocked();
    }

    @Override public String getUsername() { return email; }
    @Override public String getPassword() { return password; }
    @Override public boolean isEnabled() { return active; }
    @Override public boolean isAccountNonLocked() { return !locked; }
    @Override public boolean isAccountNonExpired() { return true; }
    @Override public boolean isCredentialsNonExpired() { return true; }
    @Override public Collection<? extends GrantedAuthority> getAuthorities() {
        return authorities;
    }
}
```

## 5.3 Custom UserDetailsService

```java
@Service
@RequiredArgsConstructor
public class CustomUserDetailsService implements UserDetailsService {

    private final UserRepository userRepository;

    @Override
    public UserDetails loadUserByUsername(String email)
            throws UsernameNotFoundException {
        User user = userRepository.findByEmail(email)
            .orElseThrow(() -> new UsernameNotFoundException(
                "User not found with email: " + email));

        if (!user.isActive()) {
            throw new DisabledException("Account is deactivated");
        }
        if (user.isLocked()) {
            throw new LockedException("Account is locked");
        }

        return new CustomUserDetails(user);
    }
}
```

---

# Part 6: Password Security and Encoding

## 6.1 Why Password Encoding?

```
NEVER store passwords as plain text!

Plain text:   password123          (compromised = instant access)
MD5 hash:     482c811da5d5b4...   (weak, rainbow table attacks)
SHA-256:      ef92b778bafe77...   (weak, no salt)
BCrypt:       $2a$10$N9qo8uL...  (strong, salted, slow by design)
```

## 6.2 Password Encoders

| Encoder | Strength | Speed | Use In Production? |
|---|---|---|---|
| `NoOpPasswordEncoder` | None | Instant | NEVER (testing only) |
| `BCryptPasswordEncoder` | Strong | ~100ms | Yes (recommended) |
| `SCryptPasswordEncoder` | Very strong | ~200ms | Yes (memory-hard) |
| `Argon2PasswordEncoder` | Strongest | ~300ms | Yes (latest standard) |

## 6.3 BCrypt (Recommended)

```java
@Bean
public PasswordEncoder passwordEncoder() {
    return new BCryptPasswordEncoder(12); // Strength 12 (2^12 iterations)
}

// Registration: encode password before saving
String rawPassword = "secret123";
String encoded = passwordEncoder.encode(rawPassword);
// $2a$12$LJ3m4ys1jN6cVKkWJPz2U.Bj6YOyI1L5lq0A9X5JVfKq3O7/HZOW.
// Each encode() call produces DIFFERENT output (random salt)

// Login: verify password
boolean matches = passwordEncoder.matches("secret123", encoded);
// true (compares correctly despite different hashes due to embedded salt)
```

## 6.4 How BCrypt Works

```
Input: "secret123"

Step 1: Generate random salt (22 characters)
        Salt: LJ3m4ys1jN6cVKkWJPz2U.

Step 2: Hash password + salt using Blowfish cipher
        Run 2^12 = 4096 iterations (slow by design!)

Step 3: Combine: $2a$12$<salt><hash>
        $2a$12$LJ3m4ys1jN6cVKkWJPz2U.Bj6YOyI1L5lq0A9X5JVfKq3O7/HZOW.

Why BCrypt is secure:
- Salt prevents rainbow table attacks
- Slow hashing prevents brute force (4096 iterations)
- Cost factor can be increased as hardware gets faster
```

## 6.5 Delegating Password Encoder

```java
// Supports multiple encoders for migration scenarios
@Bean
public PasswordEncoder passwordEncoder() {
    return PasswordEncoderFactories.createDelegatingPasswordEncoder();
    // Stores format: {bcrypt}$2a$10$...
    // Supports: {bcrypt}, {scrypt}, {argon2}, {noop}
    // Default encoding: BCrypt
}
```

---
