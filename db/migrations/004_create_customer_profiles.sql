CREATE TABLE dbo.CustomerProfiles (
    CustomerProfileId INT IDENTITY(1,1) PRIMARY KEY,
    UserId            UNIQUEIDENTIFIER NOT NULL,
    AddressLine1      NVARCHAR(200)    NULL,
    AddressLine2      NVARCHAR(200)    NULL,
    City              NVARCHAR(100)    NULL,
    State             NVARCHAR(100)    NULL,
    Pincode           NVARCHAR(10)     NULL,
    Latitude          DECIMAL(9,6)     NULL,
    Longitude         DECIMAL(9,6)     NULL,
    PreferredTags     NVARCHAR(MAX)    NULL,
    CreatedAt         DATETIME2        NOT NULL DEFAULT SYSUTCDATETIME(),
    UpdatedAt         DATETIME2        NOT NULL DEFAULT SYSUTCDATETIME(),
    CONSTRAINT UQ_CustomerProfiles_UserId UNIQUE (UserId),
    CONSTRAINT FK_CustomerProfiles_Users FOREIGN KEY (UserId) REFERENCES dbo.Users(UserId) ON DELETE CASCADE
);
