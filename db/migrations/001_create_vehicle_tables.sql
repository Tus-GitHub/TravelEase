CREATE TABLE dbo.VehicleTypes (
    VehicleTypeId INT IDENTITY(1,1) PRIMARY KEY,
    Slug          NVARCHAR(60)   NOT NULL,
    Title         NVARCHAR(100)  NOT NULL,
    Description   NVARCHAR(500)  NULL,
    IconName      NVARCHAR(40)   NULL,
    ImageUrl      NVARCHAR(500)  NULL,
    DisplayOrder  INT            NOT NULL DEFAULT 0,
    IsActive      BIT            NOT NULL DEFAULT 1,
    CONSTRAINT UQ_VehicleTypes_Slug UNIQUE (Slug)
);

CREATE TABLE dbo.Vehicles (
    VehicleId           INT IDENTITY(1,1) PRIMARY KEY,
    VehicleTypeId       INT             NOT NULL,
    Name                NVARCHAR(150)   NOT NULL,
    RegistrationNumber  NVARCHAR(20)    NULL,
    SeatingCapacity     INT             NOT NULL,
    Features            NVARCHAR(MAX)   NULL,
    BasePricePerDay     DECIMAL(10,2)   NOT NULL,
    Rating              DECIMAL(2,1)    NULL,
    IsAvailable         BIT             NOT NULL DEFAULT 1,
    ManagedByUserId     UNIQUEIDENTIFIER NULL,
    CreatedAt           DATETIME2       NOT NULL DEFAULT SYSUTCDATETIME(),
    CONSTRAINT FK_Vehicles_VehicleTypes FOREIGN KEY (VehicleTypeId) REFERENCES dbo.VehicleTypes(VehicleTypeId),
    CONSTRAINT FK_Vehicles_ManagedByUser FOREIGN KEY (ManagedByUserId) REFERENCES dbo.Users(UserId)
);

CREATE TABLE dbo.VehicleImages (
    VehicleImageId INT IDENTITY(1,1) PRIMARY KEY,
    VehicleId      INT           NOT NULL,
    ImageUrl       NVARCHAR(500) NOT NULL,
    IsPrimary      BIT           NOT NULL DEFAULT 0,
    DisplayOrder   INT           NOT NULL DEFAULT 0,
    CONSTRAINT FK_VehicleImages_Vehicles FOREIGN KEY (VehicleId) REFERENCES dbo.Vehicles(VehicleId) ON DELETE CASCADE
);
