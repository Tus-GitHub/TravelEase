CREATE TABLE dbo.Packages (
    PackageId       INT IDENTITY(1,1) PRIMARY KEY,
    RegionId        INT             NOT NULL,
    VehicleTypeId   INT             NOT NULL,
    Name            NVARCHAR(150)   NOT NULL,
    Slug            NVARCHAR(80)    NOT NULL,
    DurationDays    INT             NOT NULL,
    ImageUrl        NVARCHAR(500)   NULL,
    Highlights      NVARCHAR(MAX)   NULL,
    MaxPersons      INT             NOT NULL,
    PricePerPerson  DECIMAL(10,2)   NOT NULL,
    Tag             NVARCHAR(40)    NULL,
    Rating          DECIMAL(2,1)    NULL,
    ReviewCount     INT             NOT NULL DEFAULT 0,
    IsActive        BIT             NOT NULL DEFAULT 1,
    CONSTRAINT UQ_Packages_Slug UNIQUE (Slug),
    CONSTRAINT FK_Packages_Regions FOREIGN KEY (RegionId) REFERENCES dbo.Regions(RegionId),
    CONSTRAINT FK_Packages_VehicleTypes FOREIGN KEY (VehicleTypeId) REFERENCES dbo.VehicleTypes(VehicleTypeId)
);

CREATE TABLE dbo.PackageStops (
    PackageStopId INT IDENTITY(1,1) PRIMARY KEY,
    PackageId     INT NOT NULL,
    TouristSpotId INT NOT NULL,
    StopOrder     INT NOT NULL,
    NightsHere    INT NOT NULL DEFAULT 0,
    CONSTRAINT FK_PackageStops_Packages FOREIGN KEY (PackageId) REFERENCES dbo.Packages(PackageId) ON DELETE CASCADE,
    CONSTRAINT FK_PackageStops_TouristSpots FOREIGN KEY (TouristSpotId) REFERENCES dbo.TouristSpots(TouristSpotId)
);
