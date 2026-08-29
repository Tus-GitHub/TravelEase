CREATE TABLE dbo.Regions (
    RegionId  INT IDENTITY(1,1) PRIMARY KEY,
    Name      NVARCHAR(100)  NOT NULL,
    State     NVARCHAR(100)  NOT NULL,
    ImageUrl  NVARCHAR(500)  NULL,
    IsActive  BIT            NOT NULL DEFAULT 1
);

CREATE TABLE dbo.Cities (
    CityId        INT IDENTITY(1,1) PRIMARY KEY,
    RegionId      INT            NOT NULL,
    Name          NVARCHAR(100)  NOT NULL,
    Latitude      DECIMAL(9,6)   NULL,
    Longitude     DECIMAL(9,6)   NULL,
    IsPickupPoint BIT            NOT NULL DEFAULT 1,
    IsAirport     BIT            NOT NULL DEFAULT 0,
    CONSTRAINT FK_Cities_Regions FOREIGN KEY (RegionId) REFERENCES dbo.Regions(RegionId)
);

CREATE TABLE dbo.TouristSpots (
    TouristSpotId INT IDENTITY(1,1) PRIMARY KEY,
    CityId        INT             NOT NULL,
    Name          NVARCHAR(150)   NOT NULL,
    Tag           NVARCHAR(60)    NULL,
    Description   NVARCHAR(1000)  NULL,
    ImageUrl      NVARCHAR(500)   NULL,
    DisplayOrder  INT             NOT NULL DEFAULT 0,
    CONSTRAINT FK_TouristSpots_Cities FOREIGN KEY (CityId) REFERENCES dbo.Cities(CityId)
);
