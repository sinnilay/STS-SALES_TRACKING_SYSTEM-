using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace STS.Migrations
{
    /// <inheritdoc />
    public partial class AddStsConvertedAndOtherStatusFields : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "ConvertedFor",
                table: "DsrEntries",
                type: "nvarchar(max)",
                nullable: true);

            migrationBuilder.AddColumn<decimal>(
                name: "ConvertedPrice",
                table: "DsrEntries",
                type: "decimal(18,2)",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "OtherStatusText",
                table: "DsrEntries",
                type: "nvarchar(max)",
                nullable: true);

            migrationBuilder.AddColumn<bool>(
                name: "UpdatedAsAdmin",
                table: "DsrEntries",
                type: "bit",
                nullable: false,
                defaultValue: false);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "ConvertedFor",
                table: "DsrEntries");

            migrationBuilder.DropColumn(
                name: "ConvertedPrice",
                table: "DsrEntries");

            migrationBuilder.DropColumn(
                name: "OtherStatusText",
                table: "DsrEntries");

            migrationBuilder.DropColumn(
                name: "UpdatedAsAdmin",
                table: "DsrEntries");
        }
    }
}
