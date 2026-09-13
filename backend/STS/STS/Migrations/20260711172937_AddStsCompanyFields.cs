using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace STS.Migrations
{
    /// <inheritdoc />
    public partial class AddStsCompanyFields : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "CityDistrict",
                table: "SalesRecords",
                type: "nvarchar(max)",
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<string>(
                name: "CompanyAddress",
                table: "SalesRecords",
                type: "nvarchar(max)",
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<string>(
                name: "CompanyID",
                table: "SalesRecords",
                type: "nvarchar(max)",
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<string>(
                name: "CompanyName",
                table: "SalesRecords",
                type: "nvarchar(max)",
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<string>(
                name: "OwnerName",
                table: "SalesRecords",
                type: "nvarchar(max)",
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<string>(
                name: "PhoneNumber",
                table: "SalesRecords",
                type: "nvarchar(max)",
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<string>(
                name: "Pincode",
                table: "SalesRecords",
                type: "nvarchar(max)",
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<string>(
                name: "Status",
                table: "SalesRecords",
                type: "nvarchar(max)",
                nullable: false,
                defaultValue: "");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "CityDistrict",
                table: "SalesRecords");

            migrationBuilder.DropColumn(
                name: "CompanyAddress",
                table: "SalesRecords");

            migrationBuilder.DropColumn(
                name: "CompanyID",
                table: "SalesRecords");

            migrationBuilder.DropColumn(
                name: "CompanyName",
                table: "SalesRecords");

            migrationBuilder.DropColumn(
                name: "OwnerName",
                table: "SalesRecords");

            migrationBuilder.DropColumn(
                name: "PhoneNumber",
                table: "SalesRecords");

            migrationBuilder.DropColumn(
                name: "Pincode",
                table: "SalesRecords");

            migrationBuilder.DropColumn(
                name: "Status",
                table: "SalesRecords");
        }
    }
}
